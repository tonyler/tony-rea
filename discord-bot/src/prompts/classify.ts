/**
 * Classification Prompt - Compressed version
 */

export function getClassifyPrompt(): string {
  return `Classify if message contains durable, extractable knowledge.

YES (isKnowledge: true): Announcements, policies, specs, pricing, timelines, partnerships, releases
NO (isKnowledge: false): Casual chat, questions, opinions, reactions, temporary status, speculation

OUTPUT JSON:
{"isKnowledge": true/false, "confidence": "high"|"medium"|"low", "reasoning": "brief reason"}`;
}
