# Architecture

## Overview
This application is a private, no-auth internal web tool running on a Hetzner server.
It provides:
- Assistant tab (Mod + Education)
- Feed tab (project knowledge ingestion + updates)
- Threads tab (X thread generation)

## Goals
- Fast, reliable internal workflow
- Deterministic outputs (JSON schemas)
- Durable project knowledge storage with auditability
- Minimal, elegant UI
- No authentication (network boundary assumed)

## Non-Goals
- Multi-tenant accounts
- Public SaaS hardening beyond basic abuse controls
- Complex RBAC or permissions
- Embeddings-based retrieval (unless added later)

## High-Level Components
- Frontend (browser UI): tabs + forms + output panels + copy controls
- Backend API: LLM endpoints + validation + retries
- Storage layer: filesystem project store (entries + compiled kb + threads)
- Safety middleware: rate limiting, request size limits, safe error handling

## Request Flow
### Assistant (Mod/Education)
1. UI sends user message + optional context + selected project
2. Backend loads relevant KB snippets
3. Backend calls LLM with the correct prompt contract
4. Backend validates JSON against schema
5. UI renders response; Mod reply is copy-only text; sources displayed separately

### Feed Ingest
1. UI sends raw content + project selection + optional links
2. LLM returns normalized extraction JSON
3. Backend stores entry as append-only file
4. Backend updates compiled kb.md (deterministic compilation rules)
5. UI shows stored result + entry ID

### Feed Update/Supersede/Delete
1. UI selects target entry/entries or provides instruction
2. LLM returns a patch plan (supersede/deprecate/hard delete)
3. Backend applies patch atomically
4. Compiled kb.md re-generated/updated

### Thread Generation
1. UI sends content + desired number of posts + constraints
2. LLM returns posts[]
3. Backend enforces <= 280 chars per post (retry once if violated)
4. UI displays posts with per-post copy + char counts

## Data Storage Layout
Root: ./data/projects/<project_slug>/
- meta.json: project metadata
- entries/: append-only feed items (source extracts)
- archive/deprecated/: superseded entries
- kb.md: compiled “current truth”
- threads/: saved thread generations

Rationale:
- Append-only entries preserve audit history
- Supersede/deprecate prevents silent rewrites
- kb.md provides quick “current state” for prompting

## Compilation Strategy (kb.md)
- kb.md is generated from active entries only
- Deprecated entries are excluded
- Conflicts are flagged rather than merged silently
- Sources remain attached at entry level (and can be aggregated)

## Prompting Strategy
- Prompts are defined in spec/ and loaded by the backend
- Each endpoint uses a dedicated prompt contract
- All LLM responses must be valid JSON matching spec/50_OUTPUT_SCHEMAS.md
- Sources are returned as metadata; Mod reply text excludes URLs/citations

## Validation and Retry Policy
- JSON parsing + schema validation on every LLM response
- One automatic retry on invalid JSON
- Thread generation retries once if any post exceeds 280 characters
- Hard failure returns safe error message without leaking secrets

## Abuse Controls (No Auth)
- Per-IP rate limiting
- Request size limits
- Same-origin CORS
- Minimal logging (no prompts/responses by default)

## Operational Runbook
### Environment
- Required env vars:
  - OPENAI_API_KEY
  - OPENAI_MODEL
  - PORT
  - DATA_DIR (optional, default ./data)

### Scripts
- scripts/install.sh: install deps, build, prep folders
- scripts/start.sh: start server, write PID/log
- scripts/stop.sh: stop gracefully using PID
- scripts/health.sh: call /api/health
- scripts/logs.sh: tail logs

### Backups
- Back up ./data regularly (project knowledge and threads)
- Keep secrets out of repo; store env in server-level config

## Future Extensions
- Optional IP allowlist
- Embeddings search
- Versioning UI for entries
- Export/import project packs


Use the configured API key from your environment (do not commit secrets).

