Data Model

Single shared workspace.

Storage:
- Filesystem under ./data/projects/

Each project contains:
- meta.json
- kb-index.md (simple title list for retrieval)
- entries/ (full content entries with slugified filenames)
- threads/ (generated threads)
- archive/deprecated/ (superseded entries)

Entry Structure:
```json
{
  "id": "xp-madness-era",
  "title": "XP Madness Era",
  "created_at": "2026-01-22T10:35:33.417Z",
  "full_content": "The original message content exactly as received...",
  "sources": ["https://discord.com/..."],
  "tags": ["XP", "Campaign"],
  "date_detected": "2026-01-20"
}
```

Filenames:
- Entry files use slugified titles: `xp-madness-era.json`
- If multi-topic content, split into multiple files

Rules:
- All new knowledge = new entry with FULL original content
- No fact extraction - preserve complete original text
- Updates = supersede old entries
- Delete defaults to deprecate
- Hard delete only if explicitly requested
- kb-index.md contains only titles for selection
- Never rewrite history silently
