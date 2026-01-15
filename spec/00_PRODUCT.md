Product Overview

Private browser-based internal tool running on a Hetzner server.
No authentication. Anyone with the URL can use it.

Purpose:
- Assist moderators/admins with accurate replies
- Educate internal workers
- Organize durable project knowledge
- Generate high-quality X threads

Tabs:
1) Assistant
   - Mode: Mod (copy-paste admin reply)
   - Mode: Education (teach the worker)
   - Grammar: Just fix the grammar of the input text and send back.

2) Feed
   - Project-based knowledge ingestion
   - Update / supersede / deprecate knowledge
   - Maintain sources as truth

3) Threads
   - Feed examples, rules, instructions
   - Generate multi-post threads (<=280 chars per post)

Constraints:
- Node.js / TypeScript only
- No Python
- No Docker
- Shell scripts only for start/stop/health
- Minimal, elegant UI
- No neon, no complex borders
- All LLM outputs must be JSON only
