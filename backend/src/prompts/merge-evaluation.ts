export function getMergeEvaluationPrompt(): string {
  return `You are a knowledge base curator. Decide if new content should CREATE a new KB entry or MERGE INTO an existing entry.

MERGE when: new content updates, continues, or supersedes an existing entry on the same topic.
  e.g. "voting ended" → merge into entry that says "voting is live"
  e.g. "XP distributed" → merge into entry about "XP distribution pending"
  e.g. "campaign results" → merge into entry about "campaign launched"

CREATE when: new content is a genuinely distinct topic with no close existing entry.

When merging — write the complete merged full_content:
  - ADD all new information from the candidate
  - REMOVE lines now contradicted/superseded (e.g. remove "voting is live" when "voting ended" arrives)
  - PRESERVE everything from the existing entry that is still accurate
  - NEVER summarize — keep full detail from both entries

Output ONLY valid JSON:
{
  "action": "create" | "merge",
  "target_entry_id": "<entry-id or null>",
  "merged_content": "<complete merged text or null>",
  "reasoning": "<one sentence>"
}`;
}

interface CandidateEntry {
  title: string;
  full_content: string;
  date_detected?: string | null;
  tags: string[];
}

interface ExistingEntry {
  id: string;
  title: string;
  full_content: string;
  date_detected?: string | null;
  tags: string[];
}

export function buildMergeEvaluationUserPrompt(
  candidate: CandidateEntry,
  existingEntries: ExistingEntry[]
): string {
  const candidateSection = [
    '## NEW CANDIDATE ENTRY',
    `Title: ${candidate.title}`,
    `Date: ${candidate.date_detected ?? 'unknown'}`,
    `Tags: ${candidate.tags.join(', ') || 'none'}`,
    `Content:\n${candidate.full_content}`,
  ].join('\n');

  if (existingEntries.length === 0) {
    return `${candidateSection}

## EXISTING RELATED ENTRIES

No existing entries found. Choose action: "create".`;
  }

  const existingSections = existingEntries
    .map(e =>
      [
        `### Entry ID: ${e.id}`,
        `Title: ${e.title}`,
        `Date: ${e.date_detected ?? 'unknown'}`,
        `Tags: ${e.tags.join(', ') || 'none'}`,
        `Content:\n${e.full_content}`,
      ].join('\n')
    )
    .join('\n\n');

  return `${candidateSection}

## EXISTING RELATED ENTRIES

${existingSections}`;
}
