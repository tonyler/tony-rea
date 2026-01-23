/**
 * Feed Ingest Prompt - Full content preservation
 * Creates titles and detects topic splits, preserves original content
 */

import { getTagsForPrompt } from '../config/tags';

export function getFeedIngestPrompt(): string {
  const predefinedTags = getTagsForPrompt();

  return `Analyze content and create knowledge base entries. PRESERVE FULL ORIGINAL CONTENT.

YOUR JOB:
1. Create a clear, descriptive title (3-6 words)
2. Detect if content covers MULTIPLE DISTINCT TOPICS
3. If multiple topics: split into separate entries, each with relevant content portion
4. If single topic: create one entry with full content
5. Assign tags from the PREDEFINED LIST below

DO NOT:
- Summarize or compress the content
- Extract facts or bullet points
- Modify the original text

PREDEFINED TAGS (use ONLY these in "tags" field):
${predefinedTags}

TAG RULES:
- Use 1-5 tags per entry from the predefined list above
- If content relates to Twitter/X (Spaces, tweets, raids, etc.), include "Twitter" tag
- If content relates to Spaces/AMA, include both "Spaces" and "AMA" tags
- If you need a tag NOT in the list, add it to "suggested_new_tags" for review

OUTPUT JSON:
{
  "entries": [
    {
      "title": "Clear Descriptive Title",
      "full_content": "The exact original content for this topic...",
      "date_detected": "YYYY-MM-DD or null",
      "tags": ["Tag1", "Tag2"],
      "suggested_new_tags": ["NewTag"],
      "sources": ["url if provided"]
    }
  ]
}

EXAMPLE 1 - Single topic with predefined tags:
Input: "XP Madness campaign runs Jan 20-27. Earn 2x XP on all activities. Bonus 500 XP for daily login streak."

{
  "entries": [
    {
      "title": "XP Madness Campaign",
      "full_content": "XP Madness campaign runs Jan 20-27. Earn 2x XP on all activities. Bonus 500 XP for daily login streak.",
      "date_detected": "2026-01-20",
      "tags": ["XP", "Campaign", "Rewards"],
      "suggested_new_tags": [],
      "sources": []
    }
  ]
}

EXAMPLE 2 - Twitter Spaces event:
Input: "Join our X Spaces with Revolve tomorrow at 4pm UTC to discuss RWA tokenization!"

{
  "entries": [
    {
      "title": "Revolve X Spaces Event",
      "full_content": "Join our X Spaces with Revolve tomorrow at 4pm UTC to discuss RWA tokenization!",
      "date_detected": null,
      "tags": ["Twitter", "Spaces", "AMA", "Event", "Revolve"],
      "suggested_new_tags": [],
      "sources": []
    }
  ]
}

EXAMPLE 3 - Content needing new tag suggestion:
Input: "We're partnering with Chainlink for oracle integration on mainnet."

{
  "entries": [
    {
      "title": "Chainlink Oracle Partnership",
      "full_content": "We're partnering with Chainlink for oracle integration on mainnet.",
      "date_detected": null,
      "tags": ["Partnership", "Integration", "Mainnet"],
      "suggested_new_tags": ["Chainlink", "Oracle"],
      "sources": []
    }
  ]
}`;
}
