# Tony Rea Articles - COMPLETE LLM COUNCIL SPECIFICATION

**Purpose:** Replace Threads feature with Claude Sonnet 4.5 + Multi-LLM Council article generation  
**Budget:** ≤$0.10/article with caching + early stops  
**Architecture:** React/Vite/Express + Claude/GPT/Gemini/Grok council  
**Date:** January 30, 2026

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Data Pipeline](#data-pipeline)
3. [X Account Analysis & Voice Profile](#x-account-analysis--voice-profile)
4. [Council Debate System](#council-debate-system)
5. [Prompt Engineering](#prompt-engineering)
6. [Budget Management](#budget-management)
7. [Continuous Chat System](#continuous-chat-system)
8. [Implementation Files](#implementation-files)
9. [API Specifications](#api-specifications)

---

## Architecture Overview

### Existing Stack (Reused)
```
Frontend: React + Vite + Tailwind
Backend: Express + Node.js
Current Features:
├── Assistant (mod replies) → ✅ UNTOUCHED
├── Feed (knowledge base) → ✅ UNTOUCHED
└── Threads (280-char) → 🔄 REPLACE WITH ARTICLES

Reused Services:
├── services/llm.ts (extend with multi-model)
├── services/storage.ts (add articles/)
├── services/api.ts (add articlesApi)
└── config/llm.ts (add Sonnet config)
```

### New Components (4 files)
```
Backend:
├── routes/articles.ts (copy threads.ts logic)
├── services/council.ts (multi-LLM orchestrator)
├── services/voice-analyzer.ts (X posts analysis)
└── prompts/articles.ts (council prompt templates)

Schemas:
├── schemas/article-result.ts (ArticleResultSchema)
└── schemas/voice-profile.ts (VoiceJSON)

Frontend:
├── pages/Articles.tsx (copy Threads.tsx)
├── features/articles/* (copy threads/*)
└── components/DebateViewer.tsx (NEW: r1/r2 JSON viewer)
```

### Storage Structure
```
data/projects/{projectId}/
├── articles/
│   ├── article-{timestamp}-{id}.json
│   └── debate-{articleId}.json
├── voice/
│   ├── voice-profile.json (cached)
│   ├── raw-posts.json (top 20 high-engagement)
│   └── last-updated.txt
└── threads/ (legacy, untouched)
```

---

## Data Pipeline

### Complete Flow (8 Steps)
```
┌─────────────────────────────────────────┐
│ USER INPUT                              │
│ content, wordCount(1200), constraints   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ STEP 1: Voice Profile Check             │
│ getVoiceProfile(projectId)              │
│ - If stale (>7 days): re-analyze posts │
│ - Else: load cached voice.json          │
│ Cost: $0.002/refresh (amortized)        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ STEP 2: Knowledge Chunks (if provided)  │
│ retrieveKnowledge(content, articles)    │
│ - RAG from Feed knowledge base          │
│ - Top 5-10 chunks, 400 tokens          │
│ Cost: $0 (existing system)              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ STEP 3: Claude Sonnet v1                │
│ claudeSonnetV1(content, voice, chunks)  │
│ Input: 2k tokens (cached style+chunks)  │
│ Output: 2k tokens (article draft)       │
│ Cost: $0.015 (w/ prompt caching)        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ STEP 4: Council Round 1 (PARALLEL)      │
│ Promise.all([                           │
│   chatgptJudge(v1, voice, 1),          │
│   geminiJudge(v1, voice, 1),           │
│   grokJudge(v1, voice, 1)              │
│ ])                                      │
│ Each scores 12 dimensions → JSON       │
│ Merge → r1.json (avg score, fixes)     │
│ Cost: $0.006 + $0.011 + $0.001 = $0.018│
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ STEP 5: Early Stop Check                │
│ if (grokScore >= 9.2) skip Round 2     │
│ Saves: $0.015 (60% cases)              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ STEP 6: Council Round 2 (PARALLEL)      │
│ Promise.all([                           │
│   chatgptJudge(r1.json, voice, 2),     │
│   geminiJudge(r1.json, voice, 2),      │
│   grokJudge(r1.json, voice, 2)         │
│ ])                                      │
│ Reviews r1.json → r2.json (distilled)  │
│ Cost: $0.015 (r1.json shorter input)   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ STEP 7: Claude Sonnet Final             │
│ claudeSonnetFinal(r2.json, voice)      │
│ Input: 4k tokens (r2+voice cached)      │
│ Output: 1.5k tokens (polished article)  │
│ Cost: $0.018 (cached + batch API)      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ STEP 8: Budget Check & Storage          │
│ totalCost = sum(all steps)              │
│ if (totalCost > $0.10) log warning      │
│ Save: article.json + debate.json        │
│ Return: ArticleResult                   │
└─────────────────────────────────────────┘
```

---

## X Account Analysis & Voice Profile

### Purpose
Extract **live writing style** from user's **top 20 high-engagement X posts** to calibrate all LLMs.

### Scraper Design (Playwright Silent)
```typescript
// services/x-scraper.ts
async function scrapePosts(handle: string): Promise<Post[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0...',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  await page.goto(`https://x.com/${handle}`);
  await page.waitForSelector('[data-testid="tweet"]');
  
  const posts = await page.$$eval('[data-testid="tweet"]', (tweets) => 
    tweets.slice(0, 50).map(t => ({
      text: t.querySelector('[data-testid="tweetText"]')?.textContent,
      likes: parseInt(t.querySelector('[data-testid="like"]')?.textContent || '0'),
      replies: parseInt(t.querySelector('[data-testid="reply"]')?.textContent || '0'),
      retweets: parseInt(t.querySelector('[data-testid="retweet"]')?.textContent || '0')
    }))
  );
  
  await browser.close();
  
  // Compute engagement rate
  return posts.map(p => ({
    ...p,
    engagement: p.likes + p.replies + p.retweets,
    impressions: estimateImpressions(p) // heuristic
  })).sort((a, b) => 
    (b.engagement / b.impressions) - (a.engagement / a.impressions)
  ).slice(0, 20); // Top 20 by engagement rate
}
```

### Voice Analyzer Prompt (Run Once)
```typescript
// prompts/voice-analyzer.ts
export const VOICE_ANALYZER_PROMPT = `
Analyze these 20 HIGH-ENGAGEMENT posts from @{handle}:

{posts.map((p, i) => `[${i+1}] (${p.engagement} eng) ${p.text}`).join('\n\n')}

**Extract LIVE VOICE JSON:**
{
  "slang": ["list", "of", "5-10", "common", "slang/jargon"],
  "hook_patterns": ["pattern 1", "pattern 2", "pattern 3"],
  "length": {
    "avg_chars": number,
    "median_chars": number,
    "max_chars": number
  },
  "emoji": {
    "rate": 0-1 (per post),
    "common": ["🔥", "🧵", "💯"]
  },
  "questions_per_post": 0-1 (frequency),
  "cta_patterns": ["Follow for X", "RT if Y"],
  "sentence_style": "Short. Punchy." or "Long flowing sentences",
  "controversy_level": "high" | "medium" | "low",
  "pov": "first_person" | "second_person" | "impersonal",
  "representative_snippets": [
    "exact line from post 1",
    "exact hook from post 5"
  ],
  "topics": ["crypto", "Cosmos", "DeFi", "trading"]
}

Output ONLY valid JSON. No markdown fences.
`;
```

### Voice Profile Schema
```typescript
// schemas/voice-profile.ts
export const VoiceProfileSchema = z.object({
  handle: z.string(),
  analyzed_at: z.string(), // ISO timestamp
  post_count: z.number(),
  slang: z.array(z.string()),
  hook_patterns: z.array(z.string()),
  length: z.object({
    avg_chars: z.number(),
    median_chars: z.number(),
    max_chars: z.number()
  }),
  emoji: z.object({
    rate: z.number(),
    common: z.array(z.string())
  }),
  questions_per_post: z.number(),
  cta_patterns: z.array(z.string()),
  sentence_style: z.string(),
  controversy_level: z.enum(['high', 'medium', 'low']),
  pov: z.enum(['first_person', 'second_person', 'impersonal']),
  representative_snippets: z.array(z.string()).length(5),
  topics: z.array(z.string())
});

type VoiceProfile = z.infer<typeof VoiceProfileSchema>;
```

### Caching & Refresh Strategy
```typescript
// services/voice-analyzer.ts
export async function getVoiceProfile(projectId: string): Promise<VoiceProfile> {
  const voicePath = `data/projects/${projectId}/voice/voice-profile.json`;
  const lastUpdatedPath = `data/projects/${projectId}/voice/last-updated.txt`;
  
  // Check if exists and < 7 days old
  if (fs.existsSync(voicePath) && fs.existsSync(lastUpdatedPath)) {
    const lastUpdated = new Date(fs.readFileSync(lastUpdatedPath, 'utf8'));
    const daysSince = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSince < 7) {
      return JSON.parse(fs.readFileSync(voicePath, 'utf8'));
    }
  }
  
  // Re-analyze
  const handle = getProjectHandle(projectId); // from project config
  const posts = await scrapePosts(handle);
  
  const voicePrompt = VOICE_ANALYZER_PROMPT
    .replace('{handle}', handle)
    .replace('{posts.map...}', posts.map((p, i) => 
      `[${i+1}] (${p.engagement} eng) ${p.text}`
    ).join('\n\n'));
  
  const voice = await callLLM(voicePrompt, {
    model: 'gpt-4o-mini',
    temperature: 0.3,
    schema: VoiceProfileSchema
  });
  
  // Save
  fs.writeFileSync(voicePath, JSON.stringify(voice, null, 2));
  fs.writeFileSync(lastUpdatedPath, new Date().toISOString());
  fs.writeFileSync(
    `data/projects/${projectId}/voice/raw-posts.json`,
    JSON.stringify(posts, null, 2)
  );
  
  return voice;
}
```

---

## Council Debate System

### 12-Dimension Judging Rubric
```typescript
// schemas/judge-rubric.ts
export const JudgeDimensions = {
  voice_match: 'Slang, rhythm, representative_snippets style',
  writing_style: 'Punchy, scannable, X-native flow',
  hooks_structure: 'Opening grab, thread flow, pacing',
  virality: 'RT/share score, reply bait, quote-worthy',
  info_validity: 'Facts match chunks, no hallucinations',
  specificity: 'Concrete numbers/examples, actionable',
  engagement: 'Sparks debate, emotional pull, relatable',
  cta: 'Follow/LIKE/RT natural, non-spammy',
  originality: 'Fresh angle, unique insights, no clichés',
  algo_safety: 'No shadowban risk, community guidelines',
  readability: 'Scannable, short paras, mobile-first',
  overall: 'Would I publish this? Portfolio-worthy?'
};

export const JudgeOpinionSchema = z.object({
  judge: z.enum(['ChatGPT', 'Gemini', 'Grok']),
  round: z.number().int().min(1).max(2),
  scores: z.object({
    voice_match: z.number().min(1).max(10),
    writing_style: z.number().min(1).max(10),
    hooks_structure: z.number().min(1).max(10),
    virality: z.number().min(1).max(10),
    info_validity: z.number().min(1).max(10),
    specificity: z.number().min(1).max(10),
    engagement: z.number().min(1).max(10),
    cta: z.number().min(1).max(10),
    originality: z.number().min(1).max(10),
    algo_safety: z.number().min(1).max(10),
    readability: z.number().min(1).max(10),
    overall: z.number().min(1).max(10)
  }),
  top_issues: z.array(z.object({
    dimension: z.string(),
    score: z.number(),
    fix: z.string()
  })).max(4),
  verdict: z.enum(['APPROVE', 'REVISE', 'REJECT']),
  reasoning: z.string()
});
```

### Round 1 & Round 2 JSONs
```typescript
// Round 1 Output (r1.json)
{
  "round": 1,
  "article_id": "article-123",
  "opinions": {
    "ChatGPT": JudgeOpinion,
    "Gemini": JudgeOpinion,
    "Grok": JudgeOpinion
  },
  "avg_scores": {
    "voice_match": 8.7,
    "writing_style": 8.5,
    ...
    "overall": 8.6
  },
  "consensus_fixes": [
    "Shorten intro (3 judges)",
    "Stronger CTA (2 judges)",
    "Add concrete example (2 judges)"
  ]
}

// Round 2 Output (r2.json - distilled)
{
  "round": 2,
  "r1_summary": "Avg 8.6, top fixes: intro, CTA",
  "opinions": {
    "ChatGPT": JudgeOpinion,
    "Gemini": JudgeOpinion,
    "Grok": JudgeOpinion
  },
  "avg_scores": {...},
  "final_consensus": "APPROVE" | "REVISE",
  "priority_fixes": [
    {fix: "CTA poll", priority: "HIGH", votes: 3},
    {fix: "Shorten para 2", priority: "MEDIUM", votes: 2}
  ]
}
```

### Orchestrator Logic
```typescript
// services/council.ts
export async function runCouncil(
  article: string,
  voice: VoiceProfile,
  budgetRemaining: number
): Promise<{r1: DebateRound, r2: DebateRound, totalCost: number}> {
  
  let totalCost = 0;
  
  // Round 1: Parallel judges
  const r1Promises = [
    judgeArticle('ChatGPT', article, voice, 1),
    judgeArticle('Gemini', article, voice, 1),
    judgeArticle('Grok', article, voice, 1)
  ];
  
  const r1Opinions = await Promise.all(r1Promises);
  const r1 = mergeDebateRound(1, r1Opinions);
  totalCost += 0.018; // Sum of judge costs
  
  // Early stop check
  const grokScore = r1.opinions.Grok.scores.overall;
  if (grokScore >= 9.2) {
    return {r1, r2: null, totalCost};
  }
  
  // Budget check
  if (totalCost + 0.015 > budgetRemaining) {
    return {r1, r2: null, totalCost};
  }
  
  // Round 2: Review r1.json
  const r2Promises = [
    judgeArticle('ChatGPT', r1, voice, 2),
    judgeArticle('Gemini', r1, voice, 2),
    judgeArticle('Grok', r1, voice, 2)
  ];
  
  const r2Opinions = await Promise.all(r2Promises);
  const r2 = mergeDebateRound(2, r2Opinions, r1);
  totalCost += 0.015;
  
  return {r1, r2, totalCost};
}
```

---

## Prompt Engineering

### Claude Sonnet v1 (Creator)
```typescript
// prompts/articles.ts - Claude v1
export function getClaudeV1Prompt(
  content: string,
  wordCount: number,
  voice: VoiceProfile,
  chunks: string[], // Knowledge from Feed
  constraints: string
): string {
  return `
<system>
You are @${voice.handle}'s writing assistant. Generate a ${wordCount}-word X/Twitter article that perfectly matches their voice.

**Rules:**
- Match LIVE VOICE exactly (slang, rhythm, hooks)
- Use KNOWLEDGE chunks for facts
- X-native: punchy, scannable, mobile-first
- No AI slop: concrete examples, no fluff
- Output clean markdown
</system>

<LIVE_VOICE>
${JSON.stringify(voice, null, 2)}

**Voice calibration:**
- Slang: ${voice.slang.join(', ')}
- Hook patterns: ${voice.hook_patterns.join(' | ')}
- Sentence style: ${voice.sentence_style}
- Representative snippets:
${voice.representative_snippets.map((s, i) => `  ${i+1}. "${s}"`).join('\n')}
</LIVE_VOICE>

<KNOWLEDGE>
${chunks.map((c, i) => `[Chunk ${i+1}]\n${c}`).join('\n\n')}
</KNOWLEDGE>

<REQUEST>
Idea: ${content}
Word count: ${wordCount} ±10%
Constraints: ${constraints || 'None'}
</REQUEST>

<OUTLINE>
Generate outline first:
- Hook (contrarian/curiosity)
- 3-5 sections with mini-hooks
- Conclusion + CTA

Then write full article.
</OUTLINE>

<thinking>
1. Review LIVE_VOICE representative_snippets
2. Map KNOWLEDGE to outline
3. Plan 1 specific anecdote
4. Draft hook variations
</thinking>

<output>
Write the article as markdown. Use voice.slang naturally. Include ## headings.
</output>
`;
}
```

### Judge Prompts (GPT/Gemini/Grok)
```typescript
// prompts/articles.ts - Round 1 Judge
export function getJudgeR1Prompt(
  judge: 'ChatGPT' | 'Gemini' | 'Grok',
  article: string,
  voice: VoiceProfile
): string {
  const specialty = {
    ChatGPT: 'structure, grammar, flow',
    Gemini: 'virality, hooks, X algo optimization',
    Grok: 'strict X/crypto accuracy, degen voice match'
  };
  
  return `
You are **${judge}** judge specializing in ${specialty[judge]}.

**Article to review:**
${article}

**LIVE VOICE target:**
${JSON.stringify(voice, null, 2)}

**Score ALL 12 dimensions (1-10):**
1. voice_match: Slang (${voice.slang.join(', ')}), rhythm, snippets style
2. writing_style: Punchy, scannable, X-native
3. hooks_structure: Opening grab, flow, pacing
4. virality: RT-worthy, reply bait, shareability
5. info_validity: Facts accurate, no hallucinations
6. specificity: Concrete examples/numbers, actionable
7. engagement: Sparks debate, emotional pull
8. cta: Natural, non-spammy conversion
9. originality: Fresh angle, no clichés
10. algo_safety: No shadowban risk (${judge === 'Grok' ? 'STRICT' : 'check'})
11. readability: Short paras, scannable, mobile
12. overall: Would you publish this?

**Output JSON ONLY:**
{
  "judge": "${judge}",
  "round": 1,
  "scores": {
    "voice_match": X,
    "writing_style": X,
    ...
    "overall": X
  },
  "top_issues": [
    {"dimension": "X", "score": Y, "fix": "specific fix"}
  ],
  "verdict": "APPROVE" | "REVISE" | "REJECT",
  "reasoning": "2-3 sentences"
}

${judge === 'Grok' ? '**BE RUTHLESS.** Call out any BS or weak hooks.' : ''}
`;
}

// Round 2 Judge (reviews r1.json)
export function getJudgeR2Prompt(
  judge: 'ChatGPT' | 'Gemini' | 'Grok',
  r1: DebateRound,
  voice: VoiceProfile
): string {
  return `
You are **${judge}** judge in **Round 2**.

**Round 1 consensus:**
${JSON.stringify(r1, null, 2)}

**Your task:**
- Review Round 1 debate
- Agree/disagree with other judges
- Score all 12 dimensions AGAIN
- New fixes or APPROVE

**Same JSON format, round: 2**

Reference Round 1 explicitly in reasoning.
${judge === 'Grok' ? 'Final strict call: APPROVE or more fixes needed?' : ''}
`;
}
```

### Claude Sonnet Final (Synthesizer)
```typescript
// prompts/articles.ts - Claude Final
export function getClaudeFinalPrompt(
  r2: DebateRound,
  voice: VoiceProfile
): string {
  return `
<system>
Synthesize **Round 2 consensus** into FINAL article.
</system>

<R2_CONSENSUS>
${JSON.stringify(r2, null, 2)}

**Priority fixes:**
${r2.priority_fixes.map(f => `- [${f.priority}] ${f.fix} (${f.votes} votes)`).join('\n')}
</R2_CONSENSUS>

<LIVE_VOICE>
${JSON.stringify(voice, null, 2)}
</LIVE_VOICE>

<INSTRUCTIONS>
1. Implement ALL HIGH priority fixes
2. Implement MEDIUM fixes if consensus
3. Prioritize Grok (strictest)
4. Match voice.slang + representative_snippets exactly
5. Output polished markdown
</INSTRUCTIONS>

<thinking>
- Which fixes conflict? Resolve via majority vote.
- Top 3 must-have fixes?
- Voice match check against snippets.
</thinking>

<output>
Final article markdown. Clean, publish-ready.
</output>
`;
}
```

---

## Budget Management

### Cost Tracking
```typescript
// services/council.ts
interface BudgetTracker {
  voiceAnalysis: number;
  claudeV1: number;
  round1Judges: number;
  round2Judges: number;
  claudeFinal: number;
  total: number;
}

export function trackCost(step: string, tokens: {input: number, output: number}): number {
  const prices = {
    'claude-sonnet-4.5': {input: 3, output: 15}, // $/M
    'gpt-4o-mini': {input: 0.15, output: 0.6},
    'gemini-2.5-flash': {input: 0.3, output: 2.5},
    'grok-4.1-fast': {input: 0.2, output: 0.5}
  };
  
  const model = getModelForStep(step);
  const cost = (
    (tokens.input / 1_000_000) * prices[model].input +
    (tokens.output / 1_000_000) * prices[model].output
  );
  
  return cost;
}

// Hard budget enforcement
export async function generateArticleWithBudget(
  content: string,
  maxBudget: number = 0.10
): Promise<ArticleResult> {
  const budget: BudgetTracker = {
    voiceAnalysis: 0,
    claudeV1: 0,
    round1Judges: 0,
    round2Judges: 0,
    claudeFinal: 0,
    total: 0
  };
  
  // Step 1: Voice
  budget.voiceAnalysis = await getVoiceWithCost();
  budget.total += budget.voiceAnalysis;
  
  // Step 2: Claude v1
  const {v1, cost: v1Cost} = await claudeV1WithCost(content);
  budget.claudeV1 = v1Cost;
  budget.total += v1Cost;
  
  if (budget.total > maxBudget) {
    return earlyExit(v1, budget);
  }
  
  // Step 3: Round 1
  const {r1, cost: r1Cost} = await councilRound1(v1);
  budget.round1Judges = r1Cost;
  budget.total += r1Cost;
  
  // Early stop check
  if (r1.opinions.Grok.scores.overall >= 9.2) {
    const final = await claudeFinal(r1);
    budget.claudeFinal = trackCost('claude-final', final.tokens);
    budget.total += budget.claudeFinal;
    return {article: final.content, debate: {r1, r2: null}, budget};
  }
  
  // Budget check
  if (budget.total + 0.03 > maxBudget) {
    const final = await claudeFinal(r1);
    return {article: final.content, debate: {r1, r2: null}, budget};
  }
  
  // Step 4: Round 2
  const {r2, cost: r2Cost} = await councilRound2(r1);
  budget.round2Judges = r2Cost;
  budget.total += r2Cost;
  
  // Step 5: Final
  const {content: finalArticle, cost: finalCost} = await claudeFinal(r2);
  budget.claudeFinal = finalCost;
  budget.total += finalCost;
  
  if (budget.total > maxBudget) {
    console.warn(`Budget exceeded: $${budget.total.toFixed(3)}`);
  }
  
  return {article: finalArticle, debate: {r1, r2}, budget};
}
```

### Optimization Strategies
```typescript
// Prompt caching (Anthropic)
const cachedMessages = [
  {
    role: 'user',
    content: [
      {
        type: 'text',
        text: VOICE_JSON + KNOWLEDGE_CHUNKS,
        cache_control: {type: 'ephemeral'} // 5min TTL
      },
      {type: 'text', text: USER_REQUEST}
    ]
  }
];

// Batch API (50% off)
const batch = await anthropic.batches.create({
  requests: [
    {custom_id: 'v1', params: claudeV1Params},
    {custom_id: 'final', params: claudeFinalParams}
  ]
});
// Results in ~1hr, $0.015 total vs $0.03

// Early stopping
if (grokScore >= 9.2 && budget.total < 0.05) {
  skipRound2();
}
```

---

## Continuous Chat System

### Architecture
```typescript
// New endpoint: POST /api/articles/:id/revise
interface RevisionRequest {
  articleId: string;
  instruction: string; // "Make intro more aggressive"
  preserveDebate: boolean; // false = new council round
}

export async function reviseArticle(req: RevisionRequest): Promise<ArticleResult> {
  const original = loadArticle(req.articleId);
  const r2 = loadDebate(req.articleId).r2;
  
  if (req.preserveDebate) {
    // Quick Claude edit (no council)
    const revised = await claudeRevise(original.content, req.instruction, r2);
    return {
      ...original,
      content: revised,
      revisions: [...original.revisions, {
        timestamp: Date.now(),
        instruction: req.instruction,
        cost: 0.018
      }]
    };
  } else {
    // Full council re-run
    return await generateArticleWithBudget(
      `REVISE: ${req.instruction}\n\nOriginal:\n${original.content}`,
      0.10
    );
  }
}
```

### Revision Prompts
```typescript
// Quick revision (preserve debate)
export function getQuickRevisionPrompt(
  article: string,
  instruction: string,
  r2: DebateRound
): string {
  return `
<original_article>
${article}
</original_article>

<r2_consensus>
${JSON.stringify(r2.priority_fixes, null, 2)}
</r2_consensus>

<revision_instruction>
${instruction}
</revision_instruction>

**Task:** Make ONLY the requested change. Preserve r2 fixes and overall quality.

Output revised article markdown.
`;
}

// Full re-council
// (same pipeline, prepend "REVISE:" to content)
```

### Frontend Chat Interface
```typescript
// components/ArticleChat.tsx
function ArticleChat({articleId}: {articleId: string}) {
  const [message, setMessage] = useState('');
  const [revising, setRevising] = useState(false);
  
  const handleRevise = async (fullCouncil = false) => {
    setRevising(true);
    const result = await articlesApi.revise({
      articleId,
      instruction: message,
      preserveDebate: !fullCouncil
    });
    setArticle(result);
    setMessage('');
    setRevising(false);
  };
  
  return (
    <div className="chat-box">
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Ask for changes: 'Make intro punchier' or 'Add more Cosmos examples'"
      />
      <div className="flex gap-2">
        <button onClick={() => handleRevise(false)}>
          Quick Edit ($0.02)
        </button>
        <button onClick={() => handleRevise(true)}>
          Re-Council ($0.05)
        </button>
      </div>
    </div>
  );
}
```

---

## Implementation Files

### Backend Structure
```
backend/src/
├── routes/
│   ├── articles.ts (NEW - copy threads.ts)
│   │   - POST /generate
│   │   - POST /save
│   │   - GET /:projectId
│   │   - POST /:id/revise
│   └── threads.ts (KEEP legacy)
│
├── services/
│   ├── council.ts (NEW)
│   │   - runCouncil()
│   │   - judgeArticle()
│   │   - mergeDebateRound()
│   │
│   ├── voice-analyzer.ts (NEW)
│   │   - getVoiceProfile()
│   │   - analyzeVoice()
│   │
│   ├── x-scraper.ts (NEW)
│   │   - scrapePosts()
│   │
│   ├── llm.ts (EXTEND)
│   │   - callLLM() → add multi-model support
│   │   - claudeSonnet()
│   │   - gptMini()
│   │   - geminiFlash()
│   │   - grokFast()
│   │
│   └── storage.ts (EXTEND)
│       - saveArticle()
│       - loadArticle()
│       - saveDebate()
│
├── prompts/
│   ├── articles.ts (NEW)
│   │   - getClaudeV1Prompt()
│   │   - getJudgeR1Prompt()
│   │   - getJudgeR2Prompt()
│   │   - getClaudeFinalPrompt()
│   │
│   └── voice-analyzer.ts (NEW)
│       - VOICE_ANALYZER_PROMPT
│
├── schemas/
│   ├── article-result.ts (NEW)
│   │   - ArticleResultSchema
│   │   - DebateRoundSchema
│   │
│   └── voice-profile.ts (NEW)
│       - VoiceProfileSchema
│
└── config/
    └── llm.ts (EXTEND)
        - Add sonnet-4.5 config
        - Temperature: 0.7 articles
```

### Frontend Structure
```
frontend/src/
├── pages/
│   ├── Articles.tsx (NEW - copy Threads.tsx)
│   └── Threads.tsx (KEEP legacy)
│
├── features/articles/ (NEW - copy threads/)
│   ├── hooks/
│   │   └── useArticles.ts
│   ├── types.ts
│   └── components/
│       ├── ArticleEditor.tsx
│       ├── DebateViewer.tsx (NEW)
│       └── ArticleChat.tsx (NEW)
│
├── services/
│   └── api.ts (EXTEND)
│       - articlesApi.generate()
│       - articlesApi.save()
│       - articlesApi.revise()
│
└── app/
    ├── App.tsx (EXTEND routes)
    └── layout/TabNav.tsx (ADD Articles tab)
```

---

## API Specifications

### POST /api/articles/generate
```typescript
// Request
{
  projectId: string,
  content: string,       // Idea/outline
  wordCount?: number,    // Default: 1200
  constraints?: string,  // Optional: "Focus on technical aspects"
  knowledgeChunks?: string[] // From Feed
}

// Response
{
  id: string,           // article-{timestamp}-{random}
  title: string,
  content: string,      // Markdown
  wordCount: number,
  debate: {
    r1: DebateRound,
    r2: DebateRound | null
  },
  budget: BudgetTracker,
  voice: VoiceProfile,
  createdAt: string
}
```

### POST /api/articles/:id/revise
```typescript
// Request
{
  instruction: string,      // "Make intro more aggressive"
  preserveDebate: boolean  // false = full re-council
}

// Response (same as generate)
```

### GET /api/articles/:projectId
```typescript
// Response
{
  articles: Array<{
    id: string,
    title: string,
    wordCount: number,
    avgScore: number, // from r2.avg_scores.overall
    createdAt: string
  }>
}
```

---

## Example Workflow

### Initial Generation
```bash
# User input
content: "Why most Cosmos airdrop farmers lose money"
wordCount: 1200
constraints: "Keep it edgy, use degen slang"

# System flow
1. getVoiceProfile('project-cosmos-tony')
   → voice.json (cached, <7 days)

2. claudeSonnetV1(content, voice)
   → v1 article (1150 words)
   → Cost: $0.015

3. parallelRound1(v1, voice)
   → ChatGPT: 8.3, Gemini: 8.7, Grok: 9.2
   → r1.json consensus: "Shorten intro, stronger CTA"
   → Cost: $0.018

4. Check: grokScore = 9.2 → SKIP Round 2

5. claudeSonnetFinal(r1, voice)
   → Final article
   → Cost: $0.018

Total: $0.051
Return: {article, debate: {r1, r2: null}, budget}
```

### Revision (Chat)
```bash
# User: "Make the hook more controversial"
preserveDebate: true

# System
1. claudeRevise(article, "more controversial hook", r2)
   → Quick edit
   → Cost: $0.018

Total session: $0.051 + $0.018 = $0.069
```

---

## Testing Checklist

### Voice Analysis
- [ ] Scrape 20 posts successfully
- [ ] Voice JSON validates against schema
- [ ] Caching works (no re-scrape <7 days)
- [ ] Cost: ~$0.002/analysis

### Council Debate
- [ ] Round 1 parallel judges complete
- [ ] r1.json validates and merges correctly
- [ ] Round 2 references r1 in reasoning
- [ ] r2.json distills to priority_fixes
- [ ] Early stop works (grok ≥9.2)

### Budget Enforcement
- [ ] Total cost tracked accurately
- [ ] Hard stop at $0.10
- [ ] Caching saves 75% on repeated prompts
- [ ] Batch API integration (50% discount)

### Claude Quality
- [ ] v1 matches voice.slang
- [ ] Final implements r2 priority fixes
- [ ] No AI slop detected by Grok
- [ ] Word count ±10% target

### Continuous Chat
- [ ] Quick revisions preserve quality
- [ ] Full re-council available
- [ ] Revision history tracked
- [ ] Budget accumulates correctly

---

## Deployment

### Environment Variables
```bash
# .env
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=xxx
XAI_API_KEY=xai-xxx

MAX_ARTICLE_BUDGET=0.10
VOICE_REFRESH_DAYS=7
ENABLE_BATCH_API=true
ENABLE_CACHING=true
```

### Launch Steps
1. Deploy voice analyzer + scraper
2. Migrate 1 project as test
3. Generate 10 articles → measure quality
4. A/B test vs old Threads
5. Full rollout

### Monitoring
```typescript
// Track metrics
{
  avgCost: number,      // Should be ~$0.05
  avgGrokScore: number, // Should be >8.5
  earlyStopRate: number, // Should be 50-70%
  voiceCacheHitRate: number // Should be >90%
}
```

---

## Cost Summary (Per Article)

```
Voice analysis: $0.002 (amortized)
Claude Sonnet v1: $0.015 (cached)
Round 1 judges: $0.018 (parallel)
Round 2 judges: $0.015 (60% skip → $0.009 avg)
Claude Sonnet final: $0.018 (cached)
─────────────────────────────────
Total: $0.066 → $0.051 w/ optimizations

With 70% early stops: ~$0.042 avg
Max budget enforced: $0.10
```

---

## Questions for Claude Code

When you enter plan mode to implement this:

1. **Voice analyzer:** Should we use Playwright or Apify for X scraping?
2. **Council orchestrator:** Async/await or event-driven architecture?
3. **Budget tracking:** Database or in-memory during generation?
4. **Caching strategy:** Redis or file-based for voice.json?
5. **Frontend debate viewer:** JSON tree or custom component?
6. **Revision history:** Store all versions or diffs?
7. **Error handling:** Retry logic for judge failures?
8. **Rate limiting:** Per-model or global?

Start with `services/council.ts` and `routes/articles.ts` as foundation, then expand outward.
