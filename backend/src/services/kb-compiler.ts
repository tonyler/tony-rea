import { listEntries, writeKB } from './storage';
import { Entry } from './storage';

/**
 * Compiles all active entries into a knowledge base markdown file
 */
export async function compileKB(projectId: string): Promise<void> {
  const entries = await listEntries(projectId);

  // Filter out deprecated entries
  const activeEntries = entries.filter(entry => !entry.deprecated);

  if (activeEntries.length === 0) {
    await writeKB(projectId, '# Knowledge Base\n\nNo entries yet.\n');
    return;
  }

  // Build KB content
  let kb = '# Knowledge Base\n\n';
  kb += `Last compiled: ${new Date().toISOString()}\n\n`;
  kb += `Total entries: ${activeEntries.length}\n\n`;
  kb += '---\n\n';

  // Group entries by tags if available
  const taggedEntries = new Map<string, Entry[]>();
  const untaggedEntries: Entry[] = [];

  for (const entry of activeEntries) {
    const tags = entry.data.tags || [];
    if (tags.length === 0) {
      untaggedEntries.push(entry);
    } else {
      for (const tag of tags) {
        if (!taggedEntries.has(tag)) {
          taggedEntries.set(tag, []);
        }
        taggedEntries.get(tag)!.push(entry);
      }
    }
  }

  // Write tagged sections
  for (const [tag, entries] of taggedEntries.entries()) {
    kb += `## ${tag}\n\n`;

    for (const entry of entries) {
      kb += compileEntry(entry);
      kb += '\n';
    }
  }

  // Write untagged entries
  if (untaggedEntries.length > 0) {
    kb += `## General\n\n`;

    for (const entry of untaggedEntries) {
      kb += compileEntry(entry);
      kb += '\n';
    }
  }

  await writeKB(projectId, kb);
}

function compileEntry(entry: Entry): string {
  let md = `### ${entry.data.title}\n\n`;

  if (entry.data.date_detected) {
    md += `**Date:** ${entry.data.date_detected}\n\n`;
  }

  md += '**Facts:**\n\n';
  for (const fact of entry.data.extracted_facts) {
    md += `- ${fact}\n`;
  }
  md += '\n';

  if (entry.data.entities && entry.data.entities.length > 0) {
    md += '**Entities:** ';
    md += entry.data.entities.join(', ');
    md += '\n\n';
  }

  if (entry.data.sources && entry.data.sources.length > 0) {
    md += '**Sources:**\n\n';
    for (const source of entry.data.sources) {
      md += `- ${source}\n`;
    }
    md += '\n';
  }

  if (entry.data.verification_note) {
    md += `> ⚠️ ${entry.data.verification_note}\n\n`;
  }

  md += `*Entry ID: ${entry.id}*\n\n`;
  md += '---\n\n';

  return md;
}

/**
 * Detects potential conflicts in the KB
 */
export async function detectConflicts(projectId: string): Promise<string[]> {
  const entries = await listEntries(projectId);
  const activeEntries = entries.filter(entry => !entry.deprecated);

  const conflicts: string[] = [];

  // Simple conflict detection: look for entries with overlapping entities or similar titles
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

      // Check for overlapping entities
      const entities1 = new Set(entry1.data.entities || []);
      const entities2 = new Set(entry2.data.entities || []);
      const overlap = [...entities1].filter(e => entities2.has(e));

      if (overlap.length > 0) {
        conflicts.push(
          `Overlapping entities in "${entry1.data.title}" (${entry1.id}) and "${entry2.data.title}" (${entry2.id}): ${overlap.join(', ')}`
        );
      }
    }
  }

  return conflicts;
}
