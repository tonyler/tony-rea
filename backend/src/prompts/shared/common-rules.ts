/**
 * Shared prompt components for consistent LLM behavior
 */

export const jsonOutputRules = `
# JSON Output Rules
- Output ONLY valid JSON - no markdown, no explanations, no text before or after
- Ensure all strings are properly escaped
- Use null for missing optional fields, not undefined
- Arrays should be empty [] if no items, not null
`.trim();

export const hallucinationPrevention = `
# Hallucination Prevention
- NEVER invent facts, sources, URLs, or data not present in the input
- If information is missing or uncertain, acknowledge it explicitly
- Preserve exact names, numbers, dates, and URLs from source material
- When in doubt, state uncertainty rather than guessing
`.trim();

export const reasoningInstruction = `
# Reasoning Process
Before composing your response:
1. First, analyze the input to understand what is being asked
2. Identify relevant information from the provided context
3. Consider edge cases or potential issues
4. Then compose your structured response
`.trim();
