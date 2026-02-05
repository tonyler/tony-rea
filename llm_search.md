# LLM Data Storage & Search Analysis

## Overview

This document analyzes how the Tony & Rea application stores data and how the LLM retrieves relevant information to answer user prompts.

---

## 1. Data Storage Architecture

### Storage System: Filesystem-based (Not Vector Database)

The system uses **file-based storage** in a structured directory hierarchy, not a vector database or embeddings.

**Location**: `./data/projects/` (configurable via `DATA_DIR` env var)

**Directory Structure per Project**:
```
projects/
├── {project-slug}/
│   ├── meta.json                 # Project metadata
│   ├── kb-index.md               # Title index for RAG retrieval
│   ├── entries/                  # Individual knowledge entries (JSON)
│   │   ├── {entry-id}.json
│   │   └── ...
│   ├── threads/                  # Generated discussion threads
│   │   ├── thread-{id}.json
│   │   └── ...
│   └── archive/
│       └── deprecated/           # Archived/superseded entries
```

### Entry Data Model

Each knowledge entry is stored as a JSON file with this structure:

```typescript
interface Entry {
  id: string;                  // Slugified from title
  created_at: string;          // ISO timestamp
  data: {
    title: string;             // 3-6 word descriptive title
    full_content: string;      // COMPLETE original content (not summarized)
    date_detected?: string;    // YYYY-MM-DD format
    tags?: string[];           // Category tags
    sources?: string[];        // Source URLs (Discord links, MCP URIs, etc.)
    verification_note?: string;// Optional verification metadata
  };
  deprecated?: boolean;        // Deprecation flag
  superseded_by?: string;      // Reference to replacement entry
}
```

### Key Design Principle: Full Content Preservation

- **NO fact extraction, summarization, or compression**
- Original content stored exactly as received
- Multi-topic content split into separate entries by the LLM
- Entry IDs are slugified titles (e.g., `xp-madness-era`)

---

## 2. Data Flow from Different Sources

### A. Discord Bot Input Flow

```
Discord Message
     │
     ▼
Message Handler (filters by channel, user, length)
     │
     ▼
Message Queue (in-memory FIFO, max 100)
     │
     ▼
Message Processor
     │
     └─ Content → POST /api/feed/ingest
           │
           ├─ LLM: Ingest prompt (split topics, extract title)
           │
           └─ Create entries in ./data/projects/{projectId}/entries/
                 ├─ Write {entryId}.json
                 ├─ Update project meta.json
                 └─ Recompile kb-index.md
```

**Key Steps**:
1. Discord messages captured from configured channels/users
2. Filtered by guild ID, channel ID, author ID, minimum length
3. Queued in memory (max 100 messages, 2000ms process interval)
4. Sent to backend `/api/feed/ingest` endpoint
5. Discord message URL becomes the source reference

### B. Frontend User Input Flow

```
Web UI Form Submit
     │
     ▼
POST /api/feed/ingest
     │
     ├─ Body: { content: "...", sources: [...], projectId: "..." }
     │
     ▼
LLM Processing (feed-ingest prompt)
     │
     ▼
Storage: entries/{entryId}.json
```

**Direct API call** - content is processed identically to Discord input.

### C. MCP (Model Context Protocol) Integration

```
External MCP Server (knowledge bases, APIs)
     │
     ├─ POST /api/feed/mcp/explore  →  List available resources
     │
     └─ POST /api/feed/mcp/ingest   →  Fetch & ingest selected resources
           │
           └─ MCP resource URI becomes the source
```

---

## 3. LLM Retrieval & RAG Implementation

### LLM Provider & Models

| Setting | Value | Notes |
|---------|-------|-------|
| Provider | OpenAI API | Only provider supported |
| **Default Model** | `gpt-4o-mini` | Cost-optimized, very capable |
| Max Retries | 2 | Retry failed calls up to 2 times |

### Temperature Settings by Mode

| Mode | Temperature | Rationale |
|------|-------------|-----------|
| retrieval | 0.3 | Very consistent entry selection |
| grammar | 0.3 | Very consistent corrections |
| feedIngest | 0.4 | Consistent fact extraction |
| feedUpdate | 0.4 | Consistent updates |
| mod | 0.5 | Consistent but natural replies |
| education | 0.6 | Some variation for teaching |
| threads | 0.7 | Creative thread generation |

### RAG (Retrieval Augmented Generation) Pattern

The system uses a **two-stage retrieval pattern**:

#### Stage 1: Entry Selection (`retrieveRelevantEntries`)

```
┌─────────────────────────────────────────────────┐
│  Input: User question                           │
│                                                 │
│  1. Read kb-index.md (simple list):             │
│     entry-1: XP Madness Campaign                │
│     entry-2: API v2.0 Launch                    │
│     entry-3: Marketing Calendar                 │
│     ...                                         │
│                                                 │
│  2. LLM Call (temp: 0.3):                       │
│     "Which 1-5 entries COULD contain relevant   │
│      info for this question?"                   │
│                                                 │
│  3. Output: { relevant_entry_ids: [...] }       │
│     Typically 1-5 entries selected              │
└─────────────────────────────────────────────────┘
```

**Selection Strategy**: Inclusive - "better to include marginally relevant than miss the answer"

#### Stage 2: Response Generation

```
┌─────────────────────────────────────────────────┐
│  1. Load full content of selected entries       │
│     from filesystem (1-5 entries)               │
│                                                 │
│  2. Format into knowledge context:              │
│     ## XP Madness Campaign                      │
│     [Full content here]                         │
│     Source: https://discord.com/...             │
│     ---                                         │
│                                                 │
│  3. Pass to mode-specific LLM call:             │
│     - Compact system prompt (~100 tokens)       │
│     - Knowledge context (~500-2000 tokens)      │
│     - User question (~50 tokens)                │
│                                                 │
│  4. Generate response with retrieved knowledge  │
└─────────────────────────────────────────────────┘
```

### Important: No Vector Search

| Feature | Status | Notes |
|---------|--------|-------|
| Vector Embeddings | NOT USED | No embedding generation |
| Vector Database | NOT USED | No Pinecone, Weaviate, etc. |
| Semantic Search | LLM-based | Title matching by LLM |

The system relies on the LLM to perform semantic matching between the question and entry titles. This is simple and effective for small-to-medium knowledge bases.

---

## 4. Cost Estimation (GPT-4o-mini)

### Model Pricing Comparison

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Relative Cost |
|-------|----------------------|------------------------|---------------|
| **gpt-4o-mini** (default) | $0.15 | $0.60 | 1x (baseline) |
| gpt-4o | $2.50 | $10.00 | ~17x |
| gpt-4 (legacy) | $30.00 | $60.00 | ~200x |

### Actual Token Usage Per Operation

#### Answering a User Question (2 LLM calls)

| Call | Input Tokens | Output Tokens |
|------|--------------|---------------|
| Retrieval (pick entries) | ~400 | ~50 |
| Generation (answer) | ~1,500 | ~150 |
| **Total** | **~1,900** | **~200** |

#### Ingesting New Data (1 LLM call)

| Call | Input Tokens | Output Tokens |
|------|--------------|---------------|
| Feed ingest | ~800 | ~150 |
| **Total** | **~800** | **~150** |

### Cost Per Operation (GPT-4o-mini)

| Operation | Input Cost | Output Cost | **Total Cost** |
|-----------|------------|-------------|----------------|
| **Ask a question** | $0.000285 | $0.00012 | **$0.0004** |
| **Ingest new data** | $0.00012 | $0.00009 | **$0.0002** |

### Monthly Cost Projections (GPT-4o-mini)

| Usage Level | Questions/day | Ingests/day | Monthly Cost |
|-------------|---------------|-------------|--------------|
| Light | 10 | 5 | **$0.15** |
| Medium | 50 | 20 | **$0.72** |
| Heavy | 200 | 100 | **$3.00** |
| Very Heavy | 1,000 | 500 | **$15.00** |

### Cost Comparison by Model

For **50 questions + 20 ingests per day** (medium usage):

| Model | Monthly Cost | vs gpt-4o-mini |
|-------|--------------|----------------|
| **gpt-4o-mini** | $0.72 | baseline |
| gpt-4o | $12.24 | 17x more |
| gpt-4 (legacy) | $144.00 | 200x more |

### Cost by Endpoint (GPT-4o-mini)

| Endpoint | LLM Calls | Est. Cost/Call |
|----------|-----------|----------------|
| `/api/assistant/mod` | 2 | ~$0.0004 |
| `/api/assistant/education` | 2 | ~$0.0004 |
| `/api/assistant/grammar` | 1 | ~$0.0002 |
| `/api/feed/ingest` | 1 | ~$0.0002 |
| `/api/feed/update` | 1 | ~$0.0002 |
| `/api/feed/delete` | 0 | $0 |
| `/api/feed/mcp/explore` | 0 | $0 |
| `/api/feed/mcp/ingest` | 1+ | ~$0.0002/resource |

---

## 5. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUTS                                   │
├─────────────────────────────────────────────────────────────────┤
│ Discord Bot          Frontend UI           MCP Servers          │
│ (Messages)          (Web Form)             (External APIs)      │
└────┬─────────────────┬──────────────────────┬───────────────────┘
     │                 │                      │
     └─────────────────┼──────────────────────┘
                       ▼
        ┌──────────────────────────────────────┐
        │   Backend API Server                 │
        │  (Express.js + OpenAI SDK)           │
        │  Model: gpt-4o-mini (default)        │
        └─────────────┬────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
   ┌─────────────┐         ┌──────────────────┐
   │  Feed API   │         │ Assistant API    │
   │ /ingest     │         │ /mod             │
   │ /update     │         │ /education       │
   │ /delete     │         │ /grammar         │
   │ /mcp/*      │         └──────────────────┘
   └────┬────────┘                  │
        │                           │
        │      ┌────────────────────┘
        │      │
        ▼      ▼
    ┌──────────────────────────────────┐
    │    OpenAI API (gpt-4o-mini)      │
    │  - ~$0.0004 per question         │
    │  - ~$0.0002 per ingest           │
    └──────────────────────────────────┘
        │      ▲
        │      │ (knowledge context)
        ▼      │
    ┌──────────────────────────────────┐
    │  Retrieval Service               │
    │  - LLM-based title matching      │
    │  - Selects 1-5 relevant entries  │
    │  - NO vector search needed       │
    └──────┬───────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────┐
    │  Storage Service (Filesystem)    │
    │  ./data/projects/                │
    │  - entries/*.json (full content) │
    │  - kb-index.md (title index)     │
    └──────────────────────────────────┘
```

---

## 6. Example Flow: User Asks a Question

```
User: "What was the XP Madness campaign?"

1. Frontend: POST /api/assistant/mod
   - userInput: "What was the XP Madness campaign?"
   - projectId: "community-wiki"

2. Backend Assistant Route:
   a. Verify project exists
   b. Call retrieveRelevantEntries("community-wiki", query)

3. Retrieval Service:
   a. Read kb-index.md:
      entry-1: XP Madness Campaign
      entry-2: Marketing Calendar
      ...
   b. LLM Call #1 (temp: 0.3):              ← COST: ~$0.00007
      "Which 1-5 entries could answer this?"
      → Output: ["entry-1"]
   c. Load entry-1.json from filesystem
   d. Format knowledge context

4. Assistant Route (continued):
   a. Merge retrieved knowledge + user prompt
   b. LLM Call #2 (temp: 0.5):              ← COST: ~$0.00033
      System: getModPrompt(knowledge)
      User: "User Question: What was..."
      → Output: { reply: "...", confidence: "high", ... }

5. Response returned:                        TOTAL: ~$0.0004
   {
     result: { reply: "...", confidence: "high", ... },
     retrieval: {
       fallback: false,
       entryCount: 1,
       entryIds: ["entry-1"],
       sources: ["https://discord.com/channels/..."]
     }
   }
```

---

## 7. Key Takeaways

| Aspect | Details |
|--------|---------|
| **Storage** | Filesystem-based JSON files (no database) |
| **Search** | LLM semantic matching on titles (no vectors) |
| **Content** | Full preservation, no summarization |
| **Cost per question** | **~$0.0004** (gpt-4o-mini) |
| **Cost per ingest** | **~$0.0002** (gpt-4o-mini) |
| **Monthly cost (medium use)** | **~$0.72** |

### Model Recommendations

| Use Case | Recommended Model | Why |
|----------|-------------------|-----|
| **Production (cost-sensitive)** | gpt-4o-mini | Best cost/performance ratio |
| **Higher quality needs** | gpt-4o | Better reasoning, 17x cost |
| **Testing/Development** | gpt-4o-mini | Cheap experimentation |

### Scaling Considerations

- Current architecture works well for **~100-500 entries**
- For larger KBs (1000+), consider adding vector embeddings
- Vector search would reduce retrieval costs but adds infrastructure complexity
