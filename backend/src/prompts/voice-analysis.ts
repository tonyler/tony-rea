const VOICE_PROFILE_JSON_SCHEMA = `{
  "quick_dna": "2-3 sentence fingerprint of this writer's voice - what makes them instantly recognizable",
  "mechanics": {
    "avg_sentence_length": "short/medium/long with typical word count range",
    "paragraph_style": "how they structure paragraphs - length, breaks, whitespace habits",
    "punctuation_habits": "notable punctuation patterns - em dashes, ellipses, exclamation marks, etc.",
    "formatting_preferences": "headers, bold, bullets, code blocks, emoji patterns"
  },
  "lexicon": {
    "vocabulary_level": "casual/conversational/technical/academic with description",
    "signature_phrases": ["phrases this author uses repeatedly - actual quotes from their writing"],
    "filler_words": ["common filler or transition words they favor"],
    "emoji_usage": "none/sparse/moderate/heavy with specific emoji patterns"
  },
  "rhetoric": {
    "opening_patterns": ["how they typically start articles - actual patterns observed"],
    "closing_patterns": ["how they typically end articles - actual patterns observed"],
    "argument_structure": "how they build arguments - data-first, story-first, contrarian, etc.",
    "use_of_questions": "how and when they use rhetorical questions",
    "use_of_lists": "how they use numbered/bulleted lists"
  },
  "tone": {
    "primary": "dominant tone (e.g., analytical, conversational, provocative)",
    "secondary": "secondary tone that surfaces in specific contexts",
    "formality": "spectrum from casual to formal with description",
    "confidence_level": "how assertively they make claims",
    "humor_style": "type of humor if any (sarcastic, self-deprecating, dry, none)"
  },
  "rhythm": {
    "pacing": "how they control reading speed - fast/varied/measured",
    "sentence_variety": "do they mix short and long sentences or stay consistent",
    "transition_style": "how they move between ideas"
  },
  "anti_patterns": ["things this author NEVER does or actively avoids - important for maintaining authenticity"],
  "reference_snippets": [
    {
      "text": "A 1-3 sentence excerpt that exemplifies their voice",
      "why": "What makes this snippet representative"
    }
  ],
  "topics": {
    "primary_domains": ["main subject areas they write about"],
    "recurring_themes": ["themes or arguments that appear across multiple articles"]
  }
}`;

export function getSubAnalysisPrompt(batchArticles: string, batchIndex: number): { system: string; user: string } {
  const system = `You are a voice analysis specialist. Your job is to extract detailed writing style observations from a batch of articles by the same author.

Focus on concrete, specific observations with direct quotes. Do NOT generalize - cite actual patterns you see in the text.

For each dimension below, provide observations WITH evidence (direct quotes):
1. Mechanics: sentence length, paragraph structure, punctuation, formatting
2. Lexicon: vocabulary level, repeated phrases, filler words, emoji usage
3. Rhetoric: how they open articles, close articles, build arguments, use questions
4. Tone: primary tone, formality level, confidence, humor
5. Rhythm: pacing, sentence variety, transitions
6. Anti-patterns: things they clearly avoid or never do
7. Topics: what they write about, recurring themes

Be specific. Quote actual phrases. Note frequencies ("uses X in 4 of 6 articles").`;

  const user = `Analyze the writing voice in these articles (Batch ${batchIndex + 1}).

${batchArticles}

Return JSON:
{
  "observations": {
    "mechanics": "detailed observations with quotes",
    "lexicon": "detailed observations with quotes",
    "rhetoric": "detailed observations with quotes",
    "tone": "detailed observations with quotes",
    "rhythm": "detailed observations with quotes",
    "anti_patterns": "things they avoid, with evidence",
    "topics": "subject areas and recurring themes",
    "signature_phrases": ["actual repeated phrases found"],
    "notable_snippets": [
      { "text": "1-3 sentence excerpt", "why": "what it demonstrates" }
    ]
  }
}`;

  return { system, user };
}

export function getMergePrompt(subAnalyses: string[]): { system: string; user: string } {
  const system = `You are a voice profiling expert. You are given multiple sub-analyses of the same author's writing, each covering a different batch of their articles.

Your job is to synthesize these into a single, comprehensive voice profile. Resolve any contradictions by favoring patterns that appear across multiple batches. Prioritize specificity over generality.

The output must be a complete voice profile that could serve as a style guide for someone trying to write in this author's voice.`;

  const user = `Synthesize these sub-analyses into a unified voice profile.

${subAnalyses.map((a, i) => `=== SUB-ANALYSIS ${i + 1} ===\n${a}`).join('\n\n')}

Return the final profile as JSON:
${VOICE_PROFILE_JSON_SCHEMA}

Rules:
- reference_snippets: Pick the 5-8 best snippets across all batches
- signature_phrases: Include only phrases that appear in 2+ batches or are highly distinctive
- anti_patterns: Include 5-10 concrete things the author avoids
- Be specific and evidence-based throughout`;

  return { system, user };
}

export function getFullAnalysisPrompt(allArticles: string): { system: string; user: string } {
  const system = `You are a voice profiling expert. Analyze all of this author's articles to build a comprehensive voice profile.

Focus on concrete, specific observations with direct quotes. For each dimension, provide evidence from the actual text. Quote signature phrases, note recurring patterns, and identify what makes this author's voice unique.

The output profile should serve as a complete style guide for replicating this author's voice.`;

  const user = `Build a complete voice profile from these articles.

${allArticles}

Return the profile as JSON:
${VOICE_PROFILE_JSON_SCHEMA}

Rules:
- reference_snippets: Pick 5-8 excerpts that best capture the voice
- signature_phrases: Actual repeated phrases from the articles
- anti_patterns: 5-10 concrete things the author avoids
- Be specific and evidence-based - quote the actual text
- opening_patterns and closing_patterns: describe with examples from the articles`;

  return { system, user };
}
