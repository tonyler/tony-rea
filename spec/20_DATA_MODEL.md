Data Model

Single shared workspace.

Storage:
- Filesystem under ./data/projects/

Each project contains:
- meta.json
- kb.md (compiled knowledge)
- entries/ (append-only source entries)
- threads/ (generated threads)
- archive/deprecated/ (superseded entries)

Rules:
- All new knowledge = new entry
- Updates = supersede old entries
- Delete defaults to deprecate
- Hard delete only if explicitly requested
- kb.md is compiled from active entries only
- Never rewrite history silently
