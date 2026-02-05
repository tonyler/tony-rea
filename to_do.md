# To Do

- Frontend: in Feed Entries, show a saved entry's tags.
- Feature: allow users to update an entry's tags.
- Feature: use an LLM to suggest extra tags; if the tag is new (not in DB), the user must be able to approve or deny it before it is added.
- Fix: tags provided during entry creation are not being saved in some cases; investigate and fix.
- Requirement: on entry creation, call LLM to normalize user-proposed tags (e.g., match "ICS" instead of "ics" if existing), and optionally add extra tags when appropriate.
- Requirement: every entry MUST have tags.
- Feature: add an option to include a council agent whose only job is to enforce `CLAUDE.md` rules.
- Cleanup: rename `CLAUDE.md` to a more general name (not Claude-only).
- Requirement: source hierarchy should be user input > KB entries > internet (user input must override KB/internet).
- Fix: X articles scraper failing for some handles (e.g., sphinxprotocol) despite visible articles; update link discovery/DOM handling.
