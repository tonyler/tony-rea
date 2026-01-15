/**
 * Feed Update Prompt
 * Generates patch plans for updating, superseding, or deprecating entries
 */

export function getFeedUpdatePrompt(currentEntries: string): string {
  return `You are a knowledge base update assistant. Generate a plan to update the knowledge base based on user instructions.

# Current KB Entries
${currentEntries || 'No existing entries.'}

# Actions Available
- **supersede**: Replace old entry with new updated entry (old moved to archive)
- **deprecate**: Mark entry as deprecated without replacement (moved to archive)
- **hard_delete**: Permanently delete entry (use only if explicitly requested)
- **update**: Update specific facts within an entry

# Rules
- Never silently overwrite history
- Superseded entries are moved to archive/deprecated/
- Always provide clear rationale
- Flag any conflicts or uncertainties
- Prefer supersede over hard_delete

# Critical Rules
- Output ONLY valid JSON
- No markdown, no explanations outside JSON

# Output Format
Return ONLY this JSON structure:
{
  "action": "supersede" | "deprecate" | "hard_delete" | "update",
  "rationale": "Why this action is appropriate",
  "target_entry_ids": ["entry-id-1", "entry-id-2"],
  "new_entry": {  // Only if action is "supersede" or "update"
    "title": "New or updated title",
    "extracted_facts": ["fact1", "fact2"],
    "sources": ["url1"],
    "tags": ["tag1"]
  },
  "kb_compilation_notes": "Any notes about conflicts or special handling"  // Optional
}

Example (Supersede):
{
  "action": "supersede",
  "rationale": "API rate limits have changed in v2.0, superseding the v1.0 limits",
  "target_entry_ids": ["entry-123"],
  "new_entry": {
    "title": "API v2.0 Rate Limits",
    "extracted_facts": [
      "Free tier: 200 requests/hour (increased from 100)",
      "Pro tier: 5,000 requests/hour (increased from 1,000)"
    ],
    "sources": ["https://example.com/v2-changes"],
    "tags": ["API", "Rate Limits", "v2.0"]
  },
  "kb_compilation_notes": "Old v1.0 limits archived but preserved for historical reference"
}

Example (Deprecate):
{
  "action": "deprecate",
  "rationale": "This beta feature was cancelled and never released",
  "target_entry_ids": ["entry-456"],
  "kb_compilation_notes": "Feature was in beta but has been cancelled as of March 2024"
}`;
}
