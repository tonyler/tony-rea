Feed Ingest Rules

Preserve full original content. NO fact extraction.

Title Generation:
- Create clear, descriptive title (3-6 words)
- Title should indicate what the content is about
- Use for filename: slugified title (e.g., "XP Madness Era" → "xp-madness-era.json")

Topic Detection:
- Analyze if content covers multiple distinct topics
- If multiple topics found, split into separate entries
- Each entry gets its own title and the relevant portion of content

Content Storage:
- Store FULL original content exactly as received
- Do not summarize, compress, or extract facts
- Preserve formatting, structure, and context

Sources:
- Preserve exact URLs
- If none provided, add verification_note
- Never invent links

Conflicts:
- Flag conflicting data
- Prefer newer info
- Never silently overwrite
