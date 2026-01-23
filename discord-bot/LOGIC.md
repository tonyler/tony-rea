# Discord Knowledge Bot - System Logic

## Purpose

The Discord bot automatically captures knowledge from designated team members in Discord and feeds it into the project's knowledge base. This eliminates manual copy-pasting of announcements, updates, and important information.

## Core Concepts

### 1. Project Binding

Each Discord server (or specific channels within it) is bound to a **project** in the Tony & Rea system. The project stores:
- `meta.json` - Project metadata
- `entries/*.json` - Individual knowledge entries
- `kb.md` - Compiled knowledge base (regenerated automatically)

### 2. User Tracking

Only messages from **tracked users** (typically admins, team leads, or official accounts) are processed. This prevents noise from general community chat.

### 3. Channel Types

| Type | Behavior |
|------|----------|
| **Whitelisted** | ALL messages from tracked users are treated as knowledge. Ideal for announcement channels. |
| **Monitored** | Messages are first classified by LLM to determine if they contain extractable knowledge. |
| **Other** | Ignored completely. |

## Processing Pipeline

### Step 1: Filter

```
Message arrives -> Check:
1. Is author a tracked user? (No -> ignore)
2. Is server in config? (No -> ignore)
3. Is channel whitelisted or monitored? (No -> ignore)
4. Is message long enough? (No -> ignore)
```

### Step 2: Classify (monitored channels only)

The LLM evaluates whether the message contains **durable knowledge**:

**Qualifies as knowledge:**
- Factual information with 3+ months relevance
- Feature announcements
- Policy changes
- Technical specifications
- Pricing/availability info

**Does NOT qualify:**
- Casual conversation
- Questions without answers
- Pure opinions
- Short reactions ("nice!", "thanks")
- Temporary info ("server down for 5 mins")

### Step 3: Extract Facts

Using the `feed-ingest` prompt, the LLM extracts structured data:

```typescript
{
  title: "API v2.0 Release",
  date_detected: "2025-01-20",
  extracted_facts: [
    "API v2.0 is now live",
    "Rate limit: 500/hr free tier, 5000/hr Pro"
  ],
  entities: ["API v2.0", "rate limit"],
  tags: ["api", "release", "pricing"],
  sources: ["discord://server/channel/message-id"],
  verification_note: null
}
```

### Step 4: Deduplication Check

Before adding a new entry, the system searches for related existing entries by:
- Title similarity
- Entity overlap (e.g., both mention "API v2.0")
- Tag overlap
- Fact keyword overlap

**Match Score Thresholds:**
- `< 0.3` -> No relation, create new entry
- `0.3 - 0.5` -> Possibly related, LLM decides
- `> 0.5` -> Likely related, LLM decides action

### Step 5: Action Decision

If related entries exist, the `feed-update` prompt determines the action:

| Action | When Used | Result |
|--------|-----------|--------|
| **Add New** | Information is complementary, not contradictory | New entry created |
| **Supersede** | New info replaces/updates old info | Old entry archived, new entry created |
| **Deprecate** | Old info is now outdated | Old entry archived, no new entry |
| **Update** | Minor correction to existing entry | Existing entry modified |
| **Hard Delete** | Old info was incorrect/harmful | Old entry permanently removed |

### Step 6: Storage & Recompilation

After any storage operation, the KB is recompiled:

1. All active (non-deprecated) entries are loaded
2. Entries are grouped by tags
3. Markdown is generated with facts, entities, sources
4. `kb.md` is written

The main app (Tony & Rea) uses `kb.md` as context for LLM queries.

## Rate Limiting

To avoid overwhelming the LLM API:

1. Messages enter a **queue** (max 100 messages)
2. Queue processes one message every 2 seconds (configurable)
3. If queue is full, oldest messages are dropped with warning

## Configuration

Each project has a config file at `discord-bot/config/{project-id}.json`:

```json
{
  "projectId": "sphinx-protocol",
  "serverId": "123456789012345678",
  "whitelistedChannels": ["111111111111111111"],
  "monitoredChannels": ["222222222222222222"],
  "trackedUsers": ["333333333333333333", "444444444444444444"],
  "enabled": true,
  "minMessageLength": 20
}
```

## Data Flow Diagram

```
+------------------------------------------------------------------+
|                         DISCORD                                   |
|  +---------------+  +---------------+  +---------------+          |
|  | #announce     |  | #team-chat    |  | #general      |          |
|  | (whitelist)   |  | (monitored)   |  | (ignored)     |          |
|  +-------+-------+  +-------+-------+  +---------------+          |
+-----------|-----------------|------------------------------------|
            |                 |
            v                 v
+------------------------------------------------------------------+
|                    DISCORD BOT                                    |
|                                                                   |
|  +-------------+    +-------------+    +-------------+            |
|  |   Filter    |--->|  Classify   |--->|   Extract   |            |
|  |             |    |  (LLM)      |    |   (LLM)     |            |
|  +-------------+    +-------------+    +------+------+            |
|                                               |                   |
|                     +-------------+    +------v------+            |
|                     |   Decide    |<---|    Find     |            |
|                     |   Action    |    |   Related   |            |
|                     |   (LLM)     |    |   Entries   |            |
|                     +------+------+    +-------------+            |
+----------------------------|-----------------------------------------+
                             |
                             v
+------------------------------------------------------------------+
|                    SHARED DATA                                    |
|                                                                   |
|  data/projects/{project}/                                         |
|  +-- entries/           <-- Create/Archive entries                |
|  |   +-- entry-001.json                                           |
|  |   +-- entry-002.json                                           |
|  +-- kb.md              <-- Recompiled after changes              |
|  +-- archive/                                                     |
|      +-- deprecated/    <-- Old entries moved here                |
|                                                                   |
+------------------------------------------------------------------+
                             |
                             v
+------------------------------------------------------------------+
|                    TONY & REA APP                                 |
|                                                                   |
|  Uses kb.md as context for:                                       |
|  - Moderator replies                                              |
|  - Education content                                              |
|  - Thread generation                                              |
|                                                                   |
+------------------------------------------------------------------+
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| LLM API error | Retry 2x, then log and skip message |
| Discord disconnect | Auto-reconnect (discord.js handles this) |
| Invalid config file | Skip that project, log error |
| Project doesn't exist | Skip messages for that project, log warning |
| KB compile fails | Log error, entries still saved |
| Queue overflow | Drop oldest messages, log warning |

## Logging

Logs are written to `logs/discord-bot/YYYY-MM-DD.log`:

```json
{"timestamp":"2025-01-20T10:30:00Z","level":"info","message":"Message queued","messageId":"123","projectId":"sphinx"}
{"timestamp":"2025-01-20T10:30:02Z","level":"info","message":"Classified as knowledge","confidence":"high"}
{"timestamp":"2025-01-20T10:30:04Z","level":"info","message":"Entry created","entryId":"entry-1705747804-abc"}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | - | Discord bot token from Developer Portal |
| `OPENAI_API_KEY` | Yes | - | OpenAI API key |
| `OPENAI_MODEL` | No | gpt-4 | Model to use for LLM calls |
| `DATA_DIR` | No | ../data | Path to shared data directory |
| `LOG_LEVEL` | No | info | Log level (debug, info, warn, error) |
| `QUEUE_PROCESS_INTERVAL_MS` | No | 2000 | Queue processing interval |
| `QUEUE_MAX_SIZE` | No | 100 | Maximum queue size |

## Getting Started

1. Create a Discord application at https://discord.com/developers/applications
2. Create a bot and get the token
3. Invite the bot to your server with `Read Messages`, `Read Message History` permissions
4. Copy `.env.example` to `.env` and fill in values
5. Create a project config in `config/{project-id}.json`
6. Run `npm install && npm run dev`
