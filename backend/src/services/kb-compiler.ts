import { listEntries, writeKBIndex } from './storage';
import { Entry } from './storage';

/**
 * Compiles a simple title index for retrieval
 * Full content is retrieved on-demand from individual entry files
 */
export async function compileKB(projectId: string): Promise<void> {
  // Just compile the title index - no more compiled kb.md
  await compileKBIndex(projectId);
}

/**
 * Compiles a title + tags index for RAG retrieval
 * Format: {entryId}: {title} [tag1, tag2, ...]
 */
export async function compileKBIndex(projectId: string): Promise<void> {
  const entries = await listEntries(projectId);

  // Filter out deprecated entries
  const activeEntries = entries.filter(entry => !entry.deprecated);

  if (activeEntries.length === 0) {
    await writeKBIndex(projectId, '');
    return;
  }

  // Sort by date (newest first)
  activeEntries.sort((a, b) => {
    const dateA = a.data.date_detected || a.created_at;
    const dateB = b.data.date_detected || b.created_at;
    return dateB.localeCompare(dateA);
  });

  // Build title + tags index
  const lines: string[] = [];

  for (const entry of activeEntries) {
    const tags = entry.data.tags && entry.data.tags.length > 0
      ? ` [${entry.data.tags.join(', ')}]`
      : '';
    const date = entry.data.date_detected ? ` (${entry.data.date_detected})` : '';
    const preview = (entry.data.full_content ?? '').replace(/\s+/g, ' ').trim().substring(0, 150);
    lines.push(`${entry.id}: ${entry.data.title}${tags}${date}\n  "${preview}"`);
  }

  await writeKBIndex(projectId, lines.join('\n'));
}

/**
 * Detects potential conflicts in the KB
 */
export async function detectConflicts(projectId: string): Promise<string[]> {
  const entries = await listEntries(projectId);
  const activeEntries = entries.filter(entry => !entry.deprecated);

  const conflicts: string[] = [];

  // Simple conflict detection: look for entries with duplicate titles
  for (let i = 0; i < activeEntries.length; i++) {
    for (let j = i + 1; j < activeEntries.length; j++) {
      const entry1 = activeEntries[i];
      const entry2 = activeEntries[j];

      // Check if titles are very similar
      const title1 = entry1.data.title.toLowerCase();
      const title2 = entry2.data.title.toLowerCase();

      if (title1 === title2) {
        conflicts.push(
          `Duplicate titles: "${entry1.data.title}" (${entry1.id}) and "${entry2.data.title}" (${entry2.id})`
        );
      }
    }
  }

  return conflicts;
}
