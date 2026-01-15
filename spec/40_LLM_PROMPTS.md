Global LLM Rules

- Output JSON ONLY
- No markdown
- No explanations outside JSON
- Never hallucinate sources
- Preserve exact names, numbers, URLs
- If unsure, ask 1 clarification OR include assumptions

All prompts must follow schemas in spec/50_OUTPUT_SCHEMAS.md
All behavior must respect:
- spec/41_MOD_VOICE.md
- spec/42_THREAD_RULES.md
- spec/43_EDUCATION_MODE.md
- spec/44_FEED_INGEST_RULES.md
