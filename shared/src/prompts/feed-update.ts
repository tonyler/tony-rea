/**
 * Feed Update Prompt - Full content version
 */

export function getFeedUpdatePrompt(currentEntries: string): string {
  return `Decide how to update KB based on new info.

EXISTING ENTRIES:
${currentEntries || 'None'}

ACTIONS:
- supersede: Replace outdated entry (archives old)
- update: Minor fix to existing entry
- deprecate: Remove obsolete entry (archives it)

OUTPUT JSON:
{
  "action": "supersede"|"update"|"deprecate",
  "rationale": "brief reason",
  "target_entry_ids": ["id1"],
  "new_entry": {"title": "...", "full_content": "The complete content...", "tags": ["tag"]}
}

Preserve full content in new_entry. new_entry required for supersede/update only.`;
}
