import * as fs from 'fs';
import * as path from 'path';
import { Article } from '../services/x-scraper';
import { DebateRound } from '../schemas/article-result';

// Load RULES.md ethics guidelines
const RULES_MD_PATH = path.join(__dirname, 'RULES.md');
const ETHICS_GUIDELINES = fs.readFileSync(RULES_MD_PATH, 'utf-8');

export interface ArticleRequest {
  type: 'topic' | 'points' | 'draft' | 'full';
  topic?: string;
  points?: string[];
  draft?: string;
  styleNotes?: string;
}

function formatExampleArticles(articles: Article[]): string {
  return articles
    .map((a, i) => `=== EXAMPLE ${i + 1} (${a.views} views, ${a.likes} likes) ===\n${a.title}\n\n${a.content}`)
    .join('\n\n---\n\n');
}

function formatUserRequest(request: ArticleRequest): string {
  const parts: string[] = [];

  if (request.type === 'topic' && request.topic) {
    parts.push(`## Topic\n${request.topic}`);
  }

  if (request.type === 'points' && request.points?.length) {
    parts.push(`## Topic\n${request.topic || 'See points below'}`);
    parts.push(`## Key Points to Support\n${request.points.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
  }

  if (request.type === 'draft' && request.draft) {
    parts.push(`## Semi-Written Draft to Enhance\n${request.draft}`);
  }

  if (request.type === 'full') {
    if (request.topic) parts.push(`## Topic\n${request.topic}`);
    if (request.points?.length) {
      parts.push(`## Key Points to Support\n${request.points.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
    }
    if (request.draft) parts.push(`## Draft Material\n${request.draft}`);
  }

  if (request.styleNotes) {
    parts.push(`## Style Requests\n${request.styleNotes}`);
  }

  return parts.join('\n\n');
}

export function getClaudeV1Prompt(
  content: string,
  wordCount: number,
  exampleArticles: Article[],
  chunks: string[],
  constraints?: string,
  request?: ArticleRequest
): { system: string; user: string } {
  const system = `# Ethics & Guidelines

${ETHICS_GUIDELINES}

---

# Voice Examples

Study these examples carefully - match the tone, sentence structure, vocabulary, and overall feel:

${formatExampleArticles(exampleArticles)}

---

# Writing Requirements

1. **Accuracy First** - Never sacrifice facts for engagement or voice matching
2. Match the voice from the examples - same energy, same style
3. Create a compelling hook that fits naturally with the example style
4. Build engagement throughout with specific examples
5. Include a soft call-to-action (not aggressive)
6. Aim for ${wordCount} words
7. Make it shareable and algorithm-friendly
8. Mark opinions as opinions, facts as facts

## Source Hierarchy (CRITICAL)
When multiple sources of information conflict, follow this priority order:
1. **User input** (topic, points, draft, style notes) — highest authority
2. **KB entries** (verified project knowledge) — trusted ground truth
3. **Internet sources** (web search results) — use for supplementary context only

If a KB entry contradicts an internet source, prefer the KB entry.
If user input contradicts KB, prefer user input (they may have newer information).

## CRITICAL: Verify All Metrics and Prices
- This step has **no web access**. Do NOT attempt to browse, call tools, or emit search queries.
- Only use numbers that are explicitly provided in the prompt or verified KB facts.
- If you cannot verify a number, use relative terms instead: "down 80% from ATH", "trading near yearly lows"
- Mark unverified numbers clearly: "reportedly", "according to unverified sources"
- Always include the date/time of any provided data point when you cite it.

${constraints ? `## Additional Constraints\n${constraints}` : ''}

# Output Format

Return a JSON object with:
{
  "title": "Title in sentence case only",
  "content": "Full article in markdown format"
}

Do not include any tool calls, browsing steps, or <search> tags. Output ONLY valid JSON.

## Title & Subheading Rules (CRITICAL)
- Use SENTENCE CASE for titles AND all subheadings/headers
- CORRECT: "Why most airdrops fail" / "How to stake your tokens"
- WRONG: "Why Most Airdrops Fail" / "How To Stake Your Tokens"
- Only capitalize: first word, proper nouns (Bitcoin, Ethereum, Cosmos), acronyms (DeFi, NFT)
- This applies to H1, H2, H3, and all markdown headers
- NO clickbait patterns: "What you need to know", "The ultimate guide", "Everything about X"
- NO parenthetical hooks: "(and why it matters)", "(and what it means)"
- NO colon formats: "Topic: the subtitle"
- Keep it direct and specific to the content`;

  let userPrompt: string;

  if (request) {
    userPrompt = `${formatUserRequest(request)}

${chunks.length > 0 ? `## Verified Knowledge Base Facts (Priority: User Input > KB > Internet)\nUse these verified facts as authoritative sources. Prefer these over guessing or using outdated info:\n${chunks.join('\n\n')}` : ''}

Target word count: ${wordCount}`;
  } else {
    // Legacy format support
    userPrompt = `## Topic
${content}

${chunks.length > 0 ? `## Verified Knowledge Base Facts (Priority: User Input > KB > Internet)\nUse these verified facts as authoritative sources. Prefer these over guessing or using outdated info:\n${chunks.join('\n\n')}` : ''}

Target word count: ${wordCount}`;
  }

  return { system, user: userPrompt };
}

const AI_SLOP_PATTERNS = [
  // Classic AI openers
  'delve into', 'let\'s explore', 'let\'s dive', 'let\'s unpack',
  'in today\'s fast-paced world', 'in the ever-evolving', 'in the world of',

  // Filler phrases
  'it\'s important to note', 'it\'s worth noting', 'it\'s crucial to understand',
  'needless to say', 'it goes without saying', 'as we all know',
  'at the end of the day', 'when all is said and done',

  // Transition slop
  'without further ado', 'that being said', 'with that in mind',
  'moving forward', 'going forward', 'as mentioned earlier',
  'as discussed above', 'as we\'ve seen',

  // Corporate/AI voice
  'leverage', 'synergy', 'paradigm shift', 'ecosystem',
  'unpack', 'circle back', 'low-hanging fruit', 'think outside the box',
  'deep dive', 'double down', 'move the needle',

  // False intimacy (Claude loves these)
  'let me be clear', 'here\'s the thing', 'look,', 'honestly,',
  'the reality is', 'the truth is', 'make no mistake',
  'i\'m not going to sugarcoat', 'let\'s be honest',

  // Rhetorical padding
  'the question is', 'the answer is simple', 'the bottom line',
  'what does this mean', 'why does this matter', 'so what',

  // Dramatic emphasis
  'everything fell apart', 'everything changed', 'then came',
  'and then everything', 'that\'s when', 'this is where',

  // Conclusory slop
  'in conclusion', 'to sum up', 'in summary', 'all in all',
  'the takeaway', 'the lesson here', 'what we\'ve learned',

  // Structure tells
  '(and it was', '(and why', '(and what', '(and how',
  ': what really', ': a deep dive', ': everything you',

  // Repetition indicators (new)
  'as mentioned earlier', 'as i said', 'as discussed',
  'to reiterate', 'once again', 'again,',
  'in other words', 'put simply', 'simply put',
  'as noted above', 'as stated before', 'to repeat',
];

const AI_TITLE_SLOP = [
  'what you need to know', 'everything you need', 'the ultimate guide',
  'a deep dive', 'what really happened', 'and why it matters',
  'and what it means', 'here\'s what', 'here is what',
  'the rise and fall', 'the complete guide', 'explained',
];

const BUZZWORD_LIST = [
  'revolutionary', 'game-changing', 'unprecedented', 'groundbreaking',
  'disruptive', 'innovative', 'cutting-edge', 'next-generation', 'world-class',
  'best-in-class', 'state-of-the-art', 'bleeding-edge', 'paradigm-shifting',
  'transformative', 'synergistic', 'holistic', 'robust', 'scalable',
  'seamless', 'frictionless', 'end-to-end', 'turnkey', 'mission-critical',
];

type JudgeRole = 'fact-checker' | 'slop-detector' | 'originality-reviewer' | 'rules-enforcer';

export function getJudgeR1Prompt(
  role: JudgeRole,
  label: string,
  article: string,
  kbKnowledge?: string
): { system: string; user: string } {
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const rolePersonalities: Record<JudgeRole, string> = {
    'fact-checker': `You are a THOROUGH FACT CHECKER. Today is ${currentDate}. Your job is to:

1. EXTRACT every single number, statistic, price, date, and factual claim from the article
2. VERIFY EACH ONE using web search - search for current data as of ${currentDate}
3. For EACH fact, report: what the article claims vs what you found
4. Flag ANY discrepancy - wrong prices, outdated stats, incorrect dates, false claims
5. Check clarity and structure too, but FACT-CHECKING IS YOUR PRIMARY JOB

Be exhaustive. Check EVERY number. Don't skip any. Cost is not a concern.`,
    'originality-reviewer': 'You focus on originality, creative expression, emotional authenticity. Penalize generic or templated writing heavily. Also check for REPETITION - same ideas rephrased, same phrases used multiple times.',
    'rules-enforcer': `You are the RULES ENFORCER. Your job is to verify the article complies with the editorial rules and ethics guidelines below. Check EVERY rule and flag violations.

## RULES TO ENFORCE:

${ETHICS_GUIDELINES}

## YOUR CHECKLIST:
1. No financial advice or price predictions
2. Opinions clearly marked as opinions
3. No banned words (matter, significant, compelling, delve, realm, em dashes)
4. Title and subheadings in sentence case
5. No engagement bait or clickbait
6. Sources credited for specific claims
7. Uncertainty acknowledged where appropriate
8. No fabricated quotes or partnerships
9. Soft CTA, not aggressive
10. Content matches voice examples (if provided)

For EACH violation found, flag it with the specific rule broken. Be thorough.`,
    'slop-detector': `You are the SLOP POLICE. Today is ${currentDate}. Your job is to:

1. Ruthlessly detect AI-generated content. If it smells like ChatGPT wrote it, score it LOW.
2. Focus ONLY on slop, voice authenticity, repetition, and buzzword density.
3. Do NOT fact-check or verify numbers. That is the fact-checker's job.

Be thorough. No shortcuts.`,
  };

  const system = `You are ${label}, a STRICT content quality reviewer.
${rolePersonalities[role]}

BE HARSH. Most AI-generated content deserves scores of 4-6, not 7-9.
A score of 8+ means EXCEPTIONAL quality that clearly wasn't AI-generated.

---

# TITLE & SUBHEADING CHECK (score as part of ai_slop)

REJECT titles AND subheadings that:
- Use Title Case Instead Of Sentence Case (only first word + proper nouns capitalized)
- This applies to the main title AND all H2/H3 headers in the article
- Contain clickbait: "what you need to know", "the ultimate guide", "everything about"
- Have parenthetical hooks: "(and why it matters)", "(and what it means)"
- Use colon subtitles: "Topic: what really happened"

GOOD title: "Why most Cosmos airdrops fail"
GOOD subheading: "How staking rewards work"
BAD title: "Why Most Cosmos Airdrops Fail: What You Need To Know"
BAD subheading: "How Staking Rewards Work"

---

# AI SLOP DETECTION (be ruthless)

These phrases are AUTOMATIC red flags - each one found should drop ai_slop by 1-2 points:
${AI_SLOP_PATTERNS.map(p => `"${p}"`).join(', ')}

Also flag:
- Overly dramatic transitions ("Then everything changed")
- False intimacy ("Let me be clear", "Here's the thing", "Look,")
- Rhetorical questions used as transitions
- Generic opening hooks that could apply to any topic
- Parenthetical asides that add fake personality

---

# BUZZWORD DETECTION
${BUZZWORD_LIST.map(b => `"${b}"`).join(', ')}

---

# REPETITION DETECTION (NEW - CRITICAL)

Score the repetition_density dimension (0-10). Detect repeated content that adds no value.

**Check for:**
- Same point made multiple times with different words (semantic repetition)
- Phrases repeated 3+ times unnecessarily (phrase repetition)
- "As mentioned earlier", "As I said before" type backreferences (filler loops)
- Conclusions that just restate the introduction
- Padding that repeats information to hit word count
- Same sentence pattern repeated (structural repetition)

**Scoring:**
- 10: Zero unnecessary repetition, every sentence adds value
- 7-9: Minor repetition, mostly fresh content
- 4-6: Noticeable repetition, some padding
- 1-3: Heavy repetition, feels like filler
- 0: Circular content that goes nowhere

If repetition_density < 5, verdict MUST be REVISE or REJECT.

---

# HUMAN VOICE TEST
- Does it have a SPECIFIC point of view, or generic "balanced" takes?
- Are there personal anecdotes or just abstract analysis?
- Would a human actually phrase it this way in conversation?
- Is the structure too clean/formulaic?

---

# FACTUAL ACCURACY CHECK (CRITICAL)

**VERIFY SPECIFIC NUMBERS BY SEARCHING THE INTERNET:**
- Token prices - search for current prices and compare
- TVL figures, market caps, trading volumes - verify against live sources
- Specific dates - confirm with reliable sources
- Statistics - check if they match current data

**Scoring guidelines for source_credibility:**
- 9-10: Numbers are current, verified, and include timestamps (e.g., "as of Feb 2024")
- 7-8: Numbers appear correct but lack explicit timestamps
- 5-6: Numbers are plausible but unverified
- 3-4: Numbers appear outdated or incorrect
- 0-2: Blatantly wrong numbers or fabricated statistics

**Flag these issues:**
- Outdated prices that don't match current market data
- Statistics that contradict verified sources
- Numbers presented without any indication of when they were accurate

**Good examples:**
- "ATOM at $8.50 (as of Feb 2024)" - timestamped and verifiable
- "down 80% from its ATH of $44" - relative with reference point
- "TVL of $500M according to DefiLlama" - sourced

---

# SCORING CALIBRATION (STRICT)

You are the quality gatekeeper. Your job is to FAIL mediocre content.

- 9-10: Reserved for exceptional human writing. You should give this < 5% of the time.
- 7-8: Good but not great. Should be rare.
- 5-6: This is where MOST AI content belongs. Default starting point.
- 3-4: Poor. Clear issues.
- 0-2: Reject.

If you're unsure between two scores, PICK THE LOWER ONE.

If you find 3+ slop patterns, ai_slop CANNOT be higher than 5.
If title is in Title Case or has clickbait, ai_slop CANNOT be higher than 6.`;

  const kbSection = kbKnowledge ? `

---

# VERIFIED PROJECT KNOWLEDGE (GROUND TRUTH - source_type: "kb")

Use these as PRIMARY source for verification. Each entry has an ID you must reference:

${kbKnowledge}

**SOURCE HIERARCHY:** User input > KB facts > Internet sources.
KB facts take precedence over web search. Use "kb" as source_type and include the entry title as source_id.

---
` : '';

  const user = `Judge this article. BE STRICT.
${kbSection}
---
ARTICLE TO REVIEW:
${article}
---

## MANDATORY: BULLET-BY-BULLET VERIFICATION

You MUST:
1. Extract EVERY verifiable claim (numbers, dates, prices, stats, facts)
2. Verify EACH claim against KB first, then web search if not in KB
3. Report status for EACH claim (match/mismatch/unverified)
4. NO claim should be left unverified unless truly impossible

Return JSON:
{
  "quality_scores": {
    "ai_slop": 0-10,
    "buzzword_density": 0-10,
    "human_voice": 0-10,
    "originality": 0-10,
    "honesty_signals": 0-10,
    "emotional_authenticity": 0-10,
    "specificity": 0-10,
    "jargon_accessibility": 0-10,
    "source_credibility": 0-10,
    "reader_respect": 0-10,
    "repetition_density": 0-10
  },
  "overall": 0-10,
  "flagged_phrases": [
    { "phrase": "exact quote", "issue": "ai_slop|buzzword|vague|dishonest|title_case|outdated_price|unverified_stat|repetition", "fix": "replacement" }
  ],
  "top_issues": [
    { "dimension": "name", "score": X, "fix": "specific fix" }
  ],
  "verdict": "APPROVE" | "REVISE" | "REJECT",
  "reasoning": "2-3 sentence summary",
  "fact_check_report": {
    "claims": [
      {
        "claim": "what is being claimed",
        "article_value": "what the article says",
        "verified_value": "what the source says",
        "source_type": "kb" | "web" | "unverified",
        "source_id": "KB entry title (if kb)",
        "source_url": "URL (if web)",
        "status": "match" | "mismatch" | "unverified"
      }
    ],
    "summary": {
      "total": <number of claims>,
      "verified_kb": <verified via KB>,
      "verified_web": <verified via web>,
      "mismatches": <claims that don't match>,
      "unverified": <could not verify>
    }
  }
}

STRICT Verification Rules:
- Extract ALL numbers, prices, dates, percentages, statistics as separate claims
- Check KB FIRST for each claim (source_type: "kb", source_id: entry title)
- If not in KB, use web search (source_type: "web", source_url: URL)
- If cannot verify at all (source_type: "unverified")
- ANY mismatch → verdict MUST be REVISE or REJECT
- If unverified > 20% of claims → source_credibility <= 5

STRICT Scoring Rules:
- If 3+ AI slop patterns found: ai_slop <= 5, verdict = REVISE or REJECT
- If title has wrong case or clickbait: ai_slop <= 6, must flag in top_issues
- If ANY mismatch in fact_check_report: source_credibility <= 4, verdict = REVISE
- If repetition_density < 5: verdict = REVISE or REJECT
- overall = WEIGHTED average: ai_slop 3x, source_credibility 3x, repetition_density 2x, human_voice 2x, originality 2x
- APPROVE only if: overall >= 8, ai_slop >= 7, source_credibility >= 6, repetition_density >= 6, mismatches = 0
- REVISE if: overall 5-7 OR any mismatch OR unverified > 20%
- REJECT if: overall < 5 OR ai_slop < 4 OR repetition_density < 4

Max 6 flagged_phrases.
Max 4 top_issues.`;

  return { system, user };
}

export function getCriticPrompt(article: string, kbKnowledge?: string): { system: string; user: string } {
  const system = `You are the CRITIC - a Devil's Advocate judge. Your job is to FIND PROBLEMS, not give praise.

Your scoring is INVERTED from other judges:
- Start at 5 (mediocre) and work DOWN for every issue found
- You CANNOT give scores above 7 unless the article is truly exceptional
- Your job is to catch what other judges miss

## Your Mission

Look specifically for:
1. Things that SOUND true but are actually false or misleading
2. Subtle repetition that other judges might miss
3. Logical inconsistencies between sections
4. Claims that are technically true but contextually misleading
5. Voice inconsistencies within the article itself
6. Pseudo-depth: words that sound smart but say nothing
7. Hidden AI patterns that aren't on the standard slop list
8. Conclusions that don't follow from the evidence

If you find zero issues, you have failed at your job.

## Scoring Philosophy

BE THE HARSHEST CRITIC:
- 9-10: You should NEVER give this. If you do, justify extensively.
- 7-8: Rare. The article must be genuinely excellent with zero issues.
- 5-6: Default. Most content lands here.
- 3-4: Found multiple issues. Normal for AI content.
- 0-2: Garbage. Multiple severe problems.

## Repetition Hunting

You are the REPETITION SPECIALIST. Specifically check:
- Does the intro promise X and the conclusion just restate the intro?
- Are there 2+ paragraphs that make the same point differently?
- Does the author keep coming back to the same example?
- Are phrases repeated verbatim 3+ times?
- Is there filler content that could be deleted without losing meaning?

Score repetition_density HARSHLY. Most AI content is 4-6 on this dimension.

## Fact Skepticism

For every claim, ask:
- "How would I verify this?"
- "Is this actually current data?"
- "Is this cherry-picked to support a narrative?"
- "What's the source quality?"

## AI Pattern Detection

Look for subtle tells:
- Perfect paragraph length consistency (AI loves 3-4 sentences per paragraph)
- Too-smooth transitions
- Balanced "on one hand... on the other hand" that avoids taking a stance
- Generic examples that could apply to any similar topic
- Conclusion that summarizes but adds nothing new`;

  const kbSection = kbKnowledge ? `

## VERIFIED FACTS (Ground Truth - use for verification)

${kbKnowledge}

Check article claims against these. Flag ANY discrepancy.
` : '';

  const user = `DESTROY this article. Find every flaw.
${kbSection}
---
ARTICLE TO REVIEW:
${article}
---

## YOUR JOB: Skeptical Verification

Extract ALL claims and verify against KB. For claims not in KB, mark as "unverified" (other judges will web-check).

Return JSON:
{
  "quality_scores": {
    "ai_slop": 0-10,
    "buzzword_density": 0-10,
    "human_voice": 0-10,
    "originality": 0-10,
    "honesty_signals": 0-10,
    "emotional_authenticity": 0-10,
    "specificity": 0-10,
    "jargon_accessibility": 0-10,
    "source_credibility": 0-10,
    "reader_respect": 0-10,
    "repetition_density": 0-10
  },
  "overall": 0-10,
  "flagged_phrases": [
    { "phrase": "exact quote", "issue": "repetition|pseudo_depth|logical_flaw|misleading|voice_inconsistency|kb_mismatch", "fix": "replacement or DELETE" }
  ],
  "top_issues": [
    { "dimension": "name", "score": X, "fix": "specific fix - be brutal" }
  ],
  "verdict": "APPROVE" | "REVISE" | "REJECT",
  "reasoning": "Be harsh. Explain every problem found.",
  "fact_check_report": {
    "claims": [
      {
        "claim": "what is being claimed",
        "article_value": "what the article says",
        "verified_value": "what KB says (or 'N/A' if not in KB)",
        "source_type": "kb" | "unverified",
        "source_id": "KB entry title (if found)",
        "status": "match" | "mismatch" | "unverified"
      }
    ],
    "summary": {
      "total": <number>,
      "verified_kb": <verified via KB>,
      "verified_web": 0,
      "mismatches": <KB contradictions>,
      "unverified": <not in KB - needs web check>
    }
  }
}

CRITIC RULES:
- Default verdict is REVISE. APPROVE needs strong justification.
- Extract EVERY verifiable claim as a bullet.
- Check each against KB. If not in KB, mark "unverified".
- ANY KB mismatch = source_credibility <= 4, verdict = REVISE/REJECT.
- List EVERY repetition instance.
- Be brutal but fair.

Max 6 flagged_phrases. Max 4 top_issues.`;

  return { system, user };
}

export function getJudgeR2Prompt(
  judge: 'ChatGPT' | 'Gemini' | 'Grok' | 'Critic',
  r1: DebateRound,
  kbKnowledge?: string
): { system: string; user: string } {
  const kbSection = kbKnowledge ? `

**VERIFIED FACTS (Ground Truth):**
${kbKnowledge}

If any judge flagged a discrepancy with these verified facts, prioritize fixing it.
` : '';

  const system = `You are ${judge}, reviewing Round 1 feedback from all judges.

Your task:
1. Review your R1 opinion and other judges' feedback
2. Consider their perspectives
3. Provide updated scores if convinced by other arguments
4. Agree or disagree with suggested fixes
5. Prioritize fixes based on impact
${kbSection}
**Priority Order for Fixes:**
1. Factual accuracy issues (highest priority)
2. Ethics violations (financial advice, false claims)
3. AI slop and buzzwords
4. Engagement and structure

Be open to changing your mind but defend your position if you have strong reasons.`;

  const opinions = Object.values(r1.opinions);
  const otherOpinions = opinions.filter((o) => o.judge !== judge);

  const user = `Round 1 Results:

Your Opinion:
${JSON.stringify(opinions.find((o) => o.judge === judge), null, 2)}

Other Judges' Opinions:
${otherOpinions.map((o) => JSON.stringify(o, null, 2)).join('\n\n')}

Consensus Fixes from R1: ${r1.consensus_fixes.join('; ')}

Return JSON (same schema as R1):
{
  "quality_scores": {
    "ai_slop": 0-10,
    "buzzword_density": 0-10,
    "human_voice": 0-10,
    "originality": 0-10,
    "honesty_signals": 0-10,
    "emotional_authenticity": 0-10,
    "specificity": 0-10,
    "jargon_accessibility": 0-10,
    "source_credibility": 0-10,
    "reader_respect": 0-10,
    "repetition_density": 0-10
  },
  "overall": 0-10,
  "flagged_phrases": [
    { "phrase": "exact quote", "issue": "ai_slop|buzzword|vague|dishonest|repetition", "fix": "replacement" }
  ],
  "top_issues": [
    { "dimension": "name", "score": X, "fix": "specific fix" }
  ],
  "verdict": "APPROVE" | "REVISE" | "REJECT",
  "reasoning": "2-3 sentence summary"
}

Max 6 flagged_phrases. Max 4 top_issues.
APPROVE = overall >= 7 AND all dimension minimums met (ai_slop >= 5, source_credibility >= 5, repetition_density >= 5, human_voice >= 4)
REVISE = 4-6 OR any dimension minimum failed
REJECT = < 4`;

  return { system, user };
}

export interface FlaggedPhraseWithJudge {
  phrase: string;
  issue: string;
  fix: string;
  judge: string;
}

export function getClaudeFinalPrompt(
  originalArticle: string,
  r2: DebateRound,
  exampleArticles: Article[],
  flaggedPhrases?: FlaggedPhraseWithJudge[]
): { system: string; user: string } {
  const voiceExamples = exampleArticles
    .slice(0, 3)
    .map((a, i) => `=== VOICE EXAMPLE ${i + 1} ===\n${a.title}\n\n${a.content.slice(0, 1800)}...`)
    .join('\n\n---\n\n');

  const system = `You are revising an article based on judge feedback.

## Core Principle
**Accuracy First** - If any fix conflicts with factual accuracy, prioritize accuracy.

## Revision Guidelines
- Apply the priority fixes while maintaining the original voice and structure
- Replace flagged phrases with the suggested fixes
- Remove AI slop patterns and buzzwords
- Make it sound more human and authentic
- Preserve what's working well
- If a fix asks you to make a false claim, ignore that fix
- Do NOT sanitize or flatten the voice; keep punchy cadence and direct address where it exists
- Preserve rhetorical devices that are natural to the voice (rhetorical questions, short punchy lines), unless they violate explicit rules

${exampleArticles.length > 0 ? `Reference these examples for the target voice:\n${voiceExamples}` : ''}`;

  const flaggedSection = flaggedPhrases && flaggedPhrases.length > 0
    ? `\n\n## Flagged Phrases to Fix
These specific phrases were flagged by judges. Replace them with the suggested fixes:

${flaggedPhrases.map((fp) => `- "${fp.phrase}" → "${fp.fix}" (${fp.issue}, flagged by ${fp.judge})`).join('\n')}`
    : '';

  const user = `Original Article:
${originalArticle}

Priority Fixes to Apply:
${r2.priority_fixes.map((f) => `- [Priority ${f.priority}] ${f.fix}`).join('\n')}

Consensus Fixes:
${r2.consensus_fixes.join('\n')}${flaggedSection}

Return JSON:
{
  "title": "Updated title if needed",
  "content": "Revised article in markdown"
}`;

  return { system, user };
}

export function getQuickRevisionPrompt(
  article: string,
  instruction: string,
  r2: DebateRound | null
): { system: string; user: string } {
  const system = `You are making a quick edit to an article based on user feedback.

## Guidelines
- Preserve the voice, structure, and quality while applying the requested change
- **Accuracy First** - Do not introduce false claims even if the user asks
- If the request would violate ethics (financial advice, false claims), note it in the output`;

  const user = `Article:
${article}

User Request: ${instruction}

${r2 ? `Previous Judge Feedback for Context:\n${r2.consensus_fixes.join('\n')}` : ''}

Return JSON:
{
  "title": "Title (update if needed)",
  "content": "Revised article in markdown"
}`;

  return { system, user };
}

// =============================================================================
// STANDALONE ETHICS REVIEW (for manual checks without voice matching)
// =============================================================================

export function getEthicsReviewPrompt(
  judge: 'ChatGPT' | 'Gemini' | 'Grok',
  article: string
): { system: string; user: string } {
  const judgeAngles: Record<string, string> = {
    ChatGPT: 'You focus on clarity, accessibility, and whether claims are properly supported.',
    Gemini: 'You focus on originality, creative expression, and emotional authenticity.',
    Grok: 'You focus on detecting BS, calling out hype, and checking if it sounds like a real human.',
  };

  const system = `You are ${judge}, an ethics and quality reviewer for written content.
${judgeAngles[judge]}

Your job is to evaluate an article on QUALITY and ETHICS metrics - NOT voice matching.
Be specific. Quote problematic phrases directly. Give actionable fixes.

---

# Scoring Dimensions

## CONTENT QUALITY (0-10 each)

### ai_slop
Detects generic AI writing patterns that make content feel robotic or templated.

**Red flags to check for:**
${AI_SLOP_PATTERNS.map(p => `- "${p}"`).join('\n')}

**Scoring:**
- 10: Zero AI patterns, reads like a human with personality
- 7-9: Minor instances, mostly natural
- 4-6: Several AI patterns, feels semi-automated
- 1-3: Heavy AI smell, could be ChatGPT default output
- 0: Pure slop, no human touch

### buzzword_density
Penalizes overuse of empty hype words that add no meaning.

**Buzzwords to flag:**
${BUZZWORD_LIST.map(b => `- "${b}"`).join('\n')}

**Scoring:**
- 10: No buzzwords, or used sparingly with substance
- 7-9: 1-2 buzzwords, not egregious
- 4-6: Multiple buzzwords weakening the content
- 1-3: Buzzword soup, more hype than substance
- 0: Unreadable marketing speak

### jargon_accessibility
Are technical terms explained? Can someone new to the topic understand?

**Scoring:**
- 10: Technical terms explained naturally, newcomer-friendly
- 7-9: Most jargon explained, minor gaps
- 4-6: Some unexplained jargon, requires prior knowledge
- 1-3: Heavy jargon, alienates newcomers
- 0: Incomprehensible to non-experts

### specificity
Concrete examples vs vague claims. Numbers vs hand-waving.

**Good:** "Revenue increased 3x from $1M to $3M"
**Bad:** "Revenue increased significantly"

**Scoring:**
- 10: Specific data, concrete examples, verifiable claims
- 7-9: Mostly specific, few vague statements
- 4-6: Mix of specific and vague
- 1-3: Mostly vague, few concrete details
- 0: All fluff, zero substance

---

## AUTHENTICITY (0-10 each)

### human_voice
Does it sound like a real person wrote it? Not corporate PR, not AI, not a committee.

**Signs of human voice:**
- Personal opinions and stakes
- Informal language where appropriate
- Imperfect but genuine expression
- Personality showing through

**Scoring:**
- 10: Clearly a real human with opinions and personality
- 7-9: Mostly human, minor corporate/AI vibes
- 4-6: Could be human or AI, hard to tell
- 1-3: Feels corporate or AI-generated
- 0: Obvious AI or corporate committee output

### originality
Fresh perspective vs rehashed common knowledge.

**Scoring:**
- 10: Novel insights, unique angle, original thinking
- 7-9: Fresh take on existing topic
- 4-6: Some original points, some common knowledge
- 1-3: Mostly rehashed, few new ideas
- 0: Copy-paste of common talking points

### honesty_signals
Does the author acknowledge uncertainty? Admit limitations? Avoid false confidence?

**Good signals:**
- "I believe..." / "In my view..."
- "This is speculation, but..."
- "I could be wrong about..."
- "The data isn't clear yet..."

**Bad signals:**
- Presenting speculation as fact
- False certainty about unpredictable outcomes
- No acknowledgment of counterarguments

**Scoring:**
- 10: Honest about uncertainty, clear about opinions vs facts
- 7-9: Mostly honest, minor overconfidence
- 4-6: Some false confidence, some honesty
- 1-3: Overconfident, presents opinions as facts
- 0: Dishonest or deceptive framing

### emotional_authenticity
Natural enthusiasm vs forced hype. Genuine concern vs manufactured urgency.

**Authentic:** Excitement backed by reasons, concern with specifics
**Inauthentic:** "This is HUGE!" without substance, "Don't miss out!" without value

**Scoring:**
- 10: Emotions feel earned and genuine
- 7-9: Mostly authentic, minor forced moments
- 4-6: Mix of genuine and forced
- 1-3: Mostly manufactured emotion
- 0: Pure hype with no authentic feeling

---

## ETHICS (0-10 each)

### source_credibility
Are claims backed by verifiable sources? Or is it "trust me bro"?

**Scoring:**
- 10: Key claims sourced or easily verifiable
- 7-9: Most claims supported, minor gaps
- 4-6: Some claims unsupported
- 1-3: Many unverified claims
- 0: No sources, pure speculation presented as fact

### reader_respect
Does it treat the reader as intelligent? Not condescending, not over-explaining, not insulting.

**Scoring:**
- 10: Respects reader intelligence, right level of explanation
- 7-9: Minor condescension or over-explanation
- 4-6: Sometimes talks down or assumes too much
- 1-3: Condescending or confusing
- 0: Insulting to reader intelligence

### repetition_density
Does every sentence add new value, or is there filler and repetition?

**Check for:**
- Same point made multiple times with different words
- Phrases repeated 3+ times unnecessarily
- "As mentioned earlier" type backreferences
- Conclusions that just restate the introduction
- Padding that repeats information

**Scoring:**
- 10: Zero unnecessary repetition, every sentence adds value
- 7-9: Minor repetition, mostly fresh content
- 4-6: Noticeable repetition, some padding
- 1-3: Heavy repetition, feels like filler
- 0: Circular content that goes nowhere`;

  const user = `Review this article for quality and ethics:

---
${article}
---

Return JSON:
{
  "scores": {
    "ai_slop": 0-10,
    "buzzword_density": 0-10,
    "jargon_accessibility": 0-10,
    "specificity": 0-10,
    "human_voice": 0-10,
    "originality": 0-10,
    "honesty_signals": 0-10,
    "emotional_authenticity": 0-10,
    "source_credibility": 0-10,
    "reader_respect": 0-10,
    "repetition_density": 0-10,
    "overall": 0-10
  },
  "flagged_phrases": [
    { "phrase": "exact quote from article", "issue": "ai_slop|buzzword|jargon|repetition|etc", "fix": "suggested replacement" }
  ],
  "strengths": ["what the article does well"],
  "verdict": "PASS" | "NEEDS_WORK" | "FAIL",
  "summary": "2-3 sentence overall assessment"
}

Rules:
- Quote actual phrases from the article in flagged_phrases
- Be specific about what's wrong and how to fix it
- Maximum 6 flagged phrases (prioritize worst offenders)
- Overall score = weighted average: ai_slop 3x, source_credibility 3x, repetition_density 2x, human_voice 2x, originality 2x
- Check minimum gates: ai_slop >= 5, source_credibility >= 5, repetition_density >= 5, human_voice >= 4
- PASS = overall >= 7 AND all minimums met, NEEDS_WORK = 4-6 OR any minimum failed, FAIL = < 4`;

  return { system, user };
}

// Types are exported from schemas/article-result.ts
