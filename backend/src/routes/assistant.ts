import { Router } from 'express';
import { z } from 'zod';
import { callLLM } from '../services/llm';
import { callMultiLLM } from '../services/multi-llm';
import { getProject, listEntries, type Entry } from '../services/storage';
import { retrieveRelevantEntries, formatRetrievedKnowledge } from '../services/retrieval';
import {
  AssistantResponseSchema,
  EducationResponseSchema,
  GrammarResponseSchema,
} from '../schemas/output-schemas';
import { getModPrompt } from '../prompts/mod';
import { getEducationPrompt } from '../prompts/education';
import { getGrammarPrompt } from '../prompts/grammar';
import { createError } from '../middleware/error-handler';
import { llmLimiter } from '../middleware/rate-limit';

const router = Router();
const DISCORD_REDIRECT_PATTERN = /\b(?:ask|check|see|post|reach\s+out|go|head)\b[^.?!\n]{0,90}\bdiscord\b/i;
const MOD_KB_BATCH_SIZE = 5;
const MAX_MOD_FACTS = 60;

const ModBatchFactSchema = z.object({
  fact: z.string(),
  entry_id: z.string(),
  date: z.string().nullable().optional(),
});

const ModBatchScanSchema = z.object({
  relevant_facts: z.array(ModBatchFactSchema),
  relevant_entry_ids: z.array(z.string()).optional().nullable(),
  can_answer: z.boolean(),
  confidence_hint: z.enum(['high', 'medium', 'low']),
  missing_info: z.array(z.string()).optional().nullable(),
});

const ModReplyVerificationSchema = z.object({
  has_unsupported_claims: z.boolean(),
  unsupported_claims: z.array(z.string()),
  corrected_reply: z.string().nullable().optional(),
});

type ModVerifiedFact = {
  fact: string;
  entryId: string;
  date?: string | null;
};

function chunkEntries(entries: Entry[], size: number): Entry[][] {
  if (size <= 0) return [entries];
  const chunks: Entry[][] = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(entries.slice(i, i + size));
  }
  return chunks;
}

function uniqueSourcesFromEntries(entries: Entry[]): string[] {
  return Array.from(new Set(
    entries
      .flatMap((entry) => entry.data.sources || [])
      .filter((source): source is string => !!source && source.trim().length > 0)
  ));
}

function orderEntriesForBatching(allEntries: Entry[], prioritizedEntries: Entry[]): Entry[] {
  if (prioritizedEntries.length === 0) return allEntries;
  const prioritizedIds = new Set(prioritizedEntries.map((entry) => entry.id));
  const remaining = allEntries.filter((entry) => !prioritizedIds.has(entry.id));
  return [...prioritizedEntries, ...remaining];
}

function buildBatchScanPrompt(
  userInput: string,
  context: string | undefined,
  knownFacts: ModVerifiedFact[],
  batch: Entry[]
): string {
  const existingFacts = knownFacts.length > 0
    ? knownFacts
      .slice(0, MAX_MOD_FACTS)
      .map((fact, idx) => `${idx + 1}. [${fact.entryId}] ${fact.fact}${fact.date ? ` (${fact.date})` : ''}`)
      .join('\n')
    : 'None yet';

  const batchIds = batch.map((entry) => `- ${entry.id}: ${entry.data.title}`).join('\n');
  const batchKnowledge = formatRetrievedKnowledge(batch);

  let prompt = `User Question: ${userInput}`;
  if (context && context.trim().length > 0) {
    prompt += `\n\nAdditional Context: ${context}`;
  }

  prompt += `\n\nAlready Confirmed Facts:\n${existingFacts}

Batch Entry IDs (ONLY these IDs are valid):
${batchIds}

KB Batch Content:
${batchKnowledge}`;

  return prompt;
}

function buildKnowledgeFromFactsAndEntries(
  facts: ModVerifiedFact[],
  missingInfo: string[],
  supportingEntries: Entry[]
): string {
  const sections: string[] = [];
  const normalizedFacts = facts
    .map((fact) => ({
      fact: fact.fact.trim(),
      entryId: fact.entryId.trim(),
      date: fact.date || null,
    }))
    .filter((fact) => fact.fact.length > 0 && fact.entryId.length > 0)
    .slice(0, MAX_MOD_FACTS);

  if (normalizedFacts.length > 0) {
    sections.push(
      `## Confirmed KB Facts\n${
        normalizedFacts
          .map((fact, idx) => `${idx + 1}. [${fact.entryId}] ${fact.fact}${fact.date ? ` (${fact.date})` : ''}`)
          .join('\n')
      }`
    );
  }

  if (supportingEntries.length > 0) {
    const lines = supportingEntries.map((entry) => {
      const date = entry.data.date_detected ? ` (${entry.data.date_detected})` : '';
      const source = entry.data.sources?.[0] ? ` | source: ${entry.data.sources[0]}` : '';
      return `- ${entry.id}: ${entry.data.title}${date}${source}`;
    });
    sections.push(`## Supporting KB Entries\n${lines.join('\n')}`);
  }

  const normalizedMissing = missingInfo
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 12);

  if (normalizedMissing.length > 0) {
    sections.push(`## Missing or Unclear\n${normalizedMissing.map((item) => `- ${item}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

interface ModBatchingResult {
  knowledge: string;
  selectedEntryIds: string[];
  sources: string[];
  verifiedFacts: ModVerifiedFact[];
  missingInfo: string[];
  batchesProcessed: number;
  entriesScanned: number;
  exhaustedAllBatches: boolean;
}

async function buildModKnowledgeInBatches(
  entries: Entry[],
  userInput: string,
  context?: string
): Promise<ModBatchingResult> {
  if (entries.length === 0) {
    return {
      knowledge: '',
      selectedEntryIds: [],
      sources: [],
      verifiedFacts: [],
      missingInfo: [],
      batchesProcessed: 0,
      entriesScanned: 0,
      exhaustedAllBatches: true,
    };
  }

  const batches = chunkEntries(entries, MOD_KB_BATCH_SIZE);
  const selectedFactsByKey = new Map<string, ModVerifiedFact>();
  const missingInfo: string[] = [];
  const selectedEntryIds = new Set<string>();
  let batchesProcessed = 0;
  let exhaustedAllBatches = true;

  for (const batch of batches) {
    batchesProcessed += 1;
    const batchIdSet = new Set(batch.map((entry) => entry.id));

    const scanResult = await callLLM(
      {
        userPrompt: buildBatchScanPrompt(userInput, context, Array.from(selectedFactsByKey.values()), batch),
        systemPrompt: `You are scanning ONE batch of KB entries (max 5 entries) to support a Discord mod answer.

Return ONLY JSON:
{
  "relevant_facts": [{"fact":"short factual statement","entry_id":"entry-id-from-this-batch","date":"YYYY-MM-DD or null"}],
  "relevant_entry_ids": ["entry-id-from-this-batch"],
  "can_answer": true/false,
  "confidence_hint": "high"|"medium"|"low",
  "missing_info": ["what is still unknown"]
}

Rules:
- Use ONLY facts from the provided batch content and already confirmed facts.
- Never invent facts.
- Each item in "relevant_facts" must include an entry_id from the batch list.
- Keep each fact atomic and specific (status/date/amount when available).
- Return up to 6 relevant_facts for this batch.
- "relevant_entry_ids" must be IDs from the batch list.
- Set "can_answer" true only if current known facts are enough to answer directly without guessing.`,
        model: 'gpt-5-mini',
        mode: 'retrieval',
        maxRetries: 0,
      },
      ModBatchScanSchema
    );

    if (!scanResult.success) {
      continue;
    }

    const data = scanResult.data;

    for (const factItem of data.relevant_facts) {
      const normalizedFact = factItem.fact.trim();
      const normalizedEntryId = factItem.entry_id.trim();
      if (!normalizedFact || !batchIdSet.has(normalizedEntryId)) {
        continue;
      }
      const key = `${normalizedEntryId}::${normalizedFact.toLowerCase()}`;
      if (!selectedFactsByKey.has(key)) {
        selectedFactsByKey.set(key, {
          fact: normalizedFact,
          entryId: normalizedEntryId,
          date: factItem.date || null,
        });
      }
      selectedEntryIds.add(normalizedEntryId);
    }

    for (const item of data.missing_info || []) {
      const normalized = item.trim();
      if (normalized && !missingInfo.includes(normalized)) {
        missingInfo.push(normalized);
      }
    }

    const validIds = (data.relevant_entry_ids || []).filter((id) => batchIdSet.has(id));
    if (validIds.length > 0) {
      for (const id of validIds) selectedEntryIds.add(id);
    } else if (data.relevant_facts.length > 0) {
      // If the model produced relevant facts but omitted IDs, keep this whole batch as supporting context.
      for (const entry of batch) {
        selectedEntryIds.add(entry.id);
      }
    }

    const enoughFactsToAnswer = data.can_answer && data.confidence_hint !== 'low' && selectedFactsByKey.size > 0;
    if (enoughFactsToAnswer) {
      exhaustedAllBatches = false;
      break;
    }
  }

  // If scanning produced nothing, still provide first batch so final answer has concrete KB context.
  if (selectedEntryIds.size === 0 && selectedFactsByKey.size === 0) {
    for (const entry of entries.slice(0, MOD_KB_BATCH_SIZE)) {
      selectedEntryIds.add(entry.id);
    }
  }

  const selectedFacts = Array.from(selectedFactsByKey.values());
  const selectedEntries = entries.filter((entry) => selectedEntryIds.has(entry.id));
  const knowledge = buildKnowledgeFromFactsAndEntries(selectedFacts, missingInfo, selectedEntries);

  return {
    knowledge,
    selectedEntryIds: selectedEntries.map((entry) => entry.id),
    sources: uniqueSourcesFromEntries(selectedEntries),
    verifiedFacts: selectedFacts,
    missingInfo,
    batchesProcessed,
    entriesScanned: Math.min(entries.length, batchesProcessed * MOD_KB_BATCH_SIZE),
    exhaustedAllBatches,
  };
}

function buildReplyVerificationPrompt(reply: string, verifiedFacts: ModVerifiedFact[]): string {
  const factsBlock = verifiedFacts.length > 0
    ? verifiedFacts
      .slice(0, MAX_MOD_FACTS)
      .map((fact, idx) => `${idx + 1}. [${fact.entryId}] ${fact.fact}${fact.date ? ` (${fact.date})` : ''}`)
      .join('\n')
    : 'No verified facts';

  return `Reply to verify:
${reply}

Verified facts:
${factsBlock}`;
}

function shouldBlockDiscordRedirect(reply: string): boolean {
  return DISCORD_REDIRECT_PATTERN.test(reply);
}

// Apply stricter rate limiting to LLM endpoints
router.use(llmLimiter);

// POST /api/assistant/mod - Mod reply generation
router.post('/mod', async (req, res, next) => {
  try {
    const { userInput, context, projectId } = req.body;

    if (!userInput || typeof userInput !== 'string') {
      throw createError('userInput is required', 400);
    }
    const contextText = typeof context === 'string' ? context : undefined;

    // Load KB using RAG if project specified
    let knowledge = '';
    let retrievalInfo = null;
    let verifiedFacts: ModVerifiedFact[] = [];
    let missingInfo: string[] = [];

    if (projectId) {
      const project = await getProject(projectId);
      if (!project) {
        throw createError('Project not found', 404);
      }

      const allEntries = await listEntries(projectId);
      const activeEntries = allEntries.filter((entry) => !entry.deprecated);

      // RAG retrieval for prioritization, then scan entries in 5-entry batches
      const retrieval = await retrieveRelevantEntries(projectId, userInput);
      const orderedEntries = (retrieval.fallback || retrieval.entries.length === 0)
        ? activeEntries
        : orderEntriesForBatching(activeEntries, retrieval.entries);

      const batchedKnowledge = await buildModKnowledgeInBatches(orderedEntries, userInput, contextText);
      knowledge = batchedKnowledge.knowledge;
      verifiedFacts = batchedKnowledge.verifiedFacts;
      missingInfo = batchedKnowledge.missingInfo;

      if (!knowledge && orderedEntries.length > 0) {
        // Last-resort safety net: send one batch so mod generation still has KB input.
        knowledge = formatRetrievedKnowledge(orderedEntries.slice(0, MOD_KB_BATCH_SIZE));
      }

      retrievalInfo = {
        fallback: retrieval.fallback || retrieval.entries.length === 0,
        entryCount: batchedKnowledge.selectedEntryIds.length,
        entryIds: batchedKnowledge.selectedEntryIds,
        reasoning: retrieval.reasoning,
        sources: batchedKnowledge.sources,
        factCount: batchedKnowledge.verifiedFacts.length,
        missingInfoCount: batchedKnowledge.missingInfo.length,
        batchesProcessed: batchedKnowledge.batchesProcessed,
        entriesScanned: batchedKnowledge.entriesScanned,
        exhaustedAllBatches: batchedKnowledge.exhaustedAllBatches,
        totalActiveEntries: activeEntries.length,
      };
    }

    // Build user prompt
    let userPrompt = `User Question: ${userInput}`;
    if (contextText) {
      userPrompt += `\n\nAdditional Context: ${contextText}`;
    }

    // Call LLM
    const result = await callLLM(
      {
        userPrompt,
        systemPrompt: getModPrompt(knowledge),
        model: 'gpt-5.1',
        mode: 'mod',
        maxRetries: 1,
      },
      AssistantResponseSchema
    );

    if (!result.success) {
      throw createError(`LLM call failed: ${result.error}`, 500);
    }

    let finalResult = result.data;

    // Guardrail: this response is posted in Discord already, so do not redirect users back to Discord.
    if (shouldBlockDiscordRedirect(finalResult.reply)) {
      const retry = await callLLM(
        {
          userPrompt,
          systemPrompt: `${getModPrompt(knowledge)}

CRITICAL OVERRIDE:
- You are already replying inside Discord.
- Do NOT tell the user to ask/check/post in Discord or "go ask in the server".
- Answer directly from provided KB facts.
- If facts are missing, say what is missing and ask exactly one clarifying follow-up question.`,
          model: 'gpt-5.1',
          mode: 'mod',
          maxRetries: 0,
        },
        AssistantResponseSchema
      );

      if (retry.success) {
        finalResult = retry.data;
      }

      if (shouldBlockDiscordRedirect(finalResult.reply)) {
        finalResult = {
          ...finalResult,
          reply: 'I do not have enough confirmed information in the current knowledge base to answer that accurately yet.',
          confidence: 'low',
          follow_up_question: finalResult.follow_up_question || 'What exact event, feature, or date should I verify for you?',
        };
      }
    }

    // Verification gate: block unsupported claims in final mod reply.
    if (verifiedFacts.length > 0) {
      const verification = await callLLM(
        {
          userPrompt: buildReplyVerificationPrompt(finalResult.reply, verifiedFacts),
          systemPrompt: `You are a strict fact-checking gate for Discord mod replies.

Return ONLY JSON:
{
  "has_unsupported_claims": true/false,
  "unsupported_claims": ["claim text"],
  "corrected_reply": "reply rewritten to use only verified facts, or null"
}

Rules:
- Verified facts are the only allowed factual source.
- If any claim in the reply is not directly supported by those facts, mark it unsupported.
- When unsupported claims exist, produce corrected_reply that removes or softens unsupported content.
- corrected_reply must be concise, direct, and must not include URLs.
- Do NOT tell users to ask/check Discord.`,
          model: 'gpt-5-mini',
          mode: 'mod',
          maxRetries: 0,
        },
        ModReplyVerificationSchema
      );

      if (verification.success && verification.data.has_unsupported_claims) {
        const correctedReply = verification.data.corrected_reply?.trim();
        if (correctedReply) {
          const priorAssumptions = (finalResult.assumptions || []).filter(Boolean);
          finalResult = {
            ...finalResult,
            reply: correctedReply,
            confidence: finalResult.confidence === 'high' ? 'medium' : finalResult.confidence,
            assumptions: [...priorAssumptions, `Removed unsupported claims (${verification.data.unsupported_claims.length}).`],
          };
        } else {
          finalResult = {
            ...finalResult,
            reply: 'I do not have enough confirmed information in the current knowledge base to answer that accurately yet.',
            confidence: 'low',
            follow_up_question: finalResult.follow_up_question || 'What exact event, feature, or date should I verify for you?',
          };
        }
      }
    } else if (projectId && missingInfo.length > 0) {
      // If no verified facts were found while KB exists, force low-confidence wording.
      finalResult = {
        ...finalResult,
        confidence: 'low',
      };
    }

    if (shouldBlockDiscordRedirect(finalResult.reply)) {
      finalResult = {
        ...finalResult,
        reply: 'I do not have enough confirmed information in the current knowledge base to answer that accurately yet.',
        confidence: 'low',
        follow_up_question: finalResult.follow_up_question || 'What exact event, feature, or date should I verify for you?',
      };
    }

    res.json({ result: finalResult, retrieval: retrievalInfo });
  } catch (error) {
    next(error);
  }
});

// POST /api/assistant/education - Education mode
router.post('/education', async (req, res, next) => {
  try {
    const { userInput, context, projectId } = req.body;

    if (!userInput || typeof userInput !== 'string') {
      throw createError('userInput is required', 400);
    }

    // Load KB using RAG if project specified
    let knowledge = '';
    let retrievalInfo = null;

    if (projectId) {
      const project = await getProject(projectId);
      if (!project) {
        throw createError('Project not found', 404);
      }

      // RAG retrieval
      const retrieval = await retrieveRelevantEntries(projectId, userInput);

      if (retrieval.fallback || retrieval.entries.length === 0) {
        // Fallback: load all entries directly
        const allEntries = await listEntries(projectId);
        const activeEntries = allEntries.filter(e => !e.deprecated);
        knowledge = formatRetrievedKnowledge(activeEntries);
        const sources = activeEntries
          .flatMap((e) => e.data.sources || [])
          .filter((s): s is string => !!s);
        retrievalInfo = { fallback: true, entryCount: activeEntries.length, sources };
      } else {
        knowledge = formatRetrievedKnowledge(retrieval.entries);
        // Collect sources from retrieved entries
        const sources = retrieval.entries
          .flatMap((e) => e.data.sources || [])
          .filter((s): s is string => !!s);
        retrievalInfo = {
          fallback: false,
          entryCount: retrieval.entries.length,
          entryIds: retrieval.entryIds,
          reasoning: retrieval.reasoning,
          sources,
        };
      }
    }

    // Build user prompt
    let userPrompt = `Topic to teach: ${userInput}`;
    if (context) {
      userPrompt += `\n\nAdditional Context: ${context}`;
    }

    // Call LLM
    const result = await callLLM(
      {
        userPrompt,
        systemPrompt: getEducationPrompt(knowledge),
        model: 'gpt-5.1',
        temperature: 1,
        maxRetries: 1,
      },
      EducationResponseSchema
    );

    if (!result.success) {
      throw createError(`LLM call failed: ${result.error}`, 500);
    }

    res.json({ result: result.data, retrieval: retrievalInfo });
  } catch (error) {
    next(error);
  }
});

// POST /api/assistant/grammar - Grammar correction
router.post('/grammar', async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      throw createError('text is required', 400);
    }

    // Call LLM — use gemini-flash via OpenRouter for grammar correction (cheap + fast)
    const result = await callMultiLLM(
      'gemini-flash',
      {
        userPrompt: text,
        systemPrompt: getGrammarPrompt(),
        temperature: 0.3,
      },
      GrammarResponseSchema
    );

    if (!result.success) {
      throw createError(`LLM call failed: ${result.error}`, 500);
    }

    res.json({ result: result.data });
  } catch (error) {
    next(error);
  }
});

export default router;
