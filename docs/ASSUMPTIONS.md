# Assumptions

This file records assumptions made by the system when user intent or input
was ambiguous. Assumptions are documented instead of silently guessing.

Only add an entry here if:
- A decision materially affects behavior or outputs
- The user did not explicitly specify the behavior
- The assumption could reasonably have alternatives

Each assumption should be:
- Concrete
- Testable
- Reversible

---

## Global Assumptions

- The application runs on a Hetzner server with a public URL and no authentication.
- Access control is handled outside the app (network / obscurity / VPN).
- Node.js and TypeScript are the only runtime technologies used.
- Data is stored on the filesystem under `./data` and is backed up externally.
- The tool is used by a small trusted group (you + coworker).

---

## Assistant (Mod Mode)

- If a user question lacks required context, the Mod reply provides a best-effort answer
  and asks **one** follow-up question instead of refusing.
- Mod replies exclude URLs and citations from the copyable text; sources are metadata only.
- If confidence is low, the reply avoids definitive language.

---

## Assistant (Education Mode)

- Education mode is intended for internal learning, not end-user delivery.
- Explanations prioritize understanding over speed.
- When information is incomplete, the response includes what must be verified.

---

## Feed Ingest

- Only durable, reusable facts are stored; ephemeral chatter is discarded.
- If no source links are provided, the entry is marked with a verification note.
- When conflicting information is detected, newer information is preferred,
  but conflicts are explicitly flagged.

---

## Feed Updates and Deletions

- “Update” implies superseding existing entries, not overwriting them.
- “Delete” defaults to deprecating entries unless the user explicitly requests a hard delete.
- Superseded entries are moved to `archive/deprecated/`.

---

## Thread Generation

- Threads default to 8 posts unless otherwise specified.
- No emojis or hashtags are included unless explicitly requested.
- All posts must be ≤ 280 characters; failures trigger a single retry.

---

## Search and Retrieval

- Knowledge retrieval uses simple text and tag matching.
- No semantic embeddings are assumed unless explicitly added later.

---

## Logging and Persistence

- Prompts and LLM responses are not logged by default.
- Minimal metadata (timestamps, endpoint, token counts) may be logged for health/debugging.

---

## Future Revisions

When user intent later clarifies an assumption:
- Update this file
- Note the change and effective date
- Do not silently alter behavior without documentation

