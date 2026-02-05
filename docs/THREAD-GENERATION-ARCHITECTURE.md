# Thread Generation Architecture

> **Purpose:** Reference document for replacing thread generation with articles.

---

## App Overview

**Tony & Rea** is an internal LLM tool with three main features:
- **Assistant** - Mod replies, education, grammar fixes
- **Feed** - Knowledge base ingestion and management
- **Threads** - X/Twitter thread generation (280 chars per post) ← **TO BE REPLACED**

**Stack:** React + Vite + Tailwind (frontend) | Express + OpenAI (backend)

---

## Thread Generation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Threads.tsx (page)                                             │
│       │                                                         │
│       ▼                                                         │
│  useThreads hook ─────────────────┐                             │
│       │                           │                             │
│       │ content, postCount,       │ thread (result)             │
│       │ constraints               │                             │
│       ▼                           │                             │
│  threadsApi.generate() ◄──────────┘                             │
│       │                                                         │
└───────│─────────────────────────────────────────────────────────┘
        │
        │ POST /api/threads/generate
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  routes/threads.ts                                              │
│       │                                                         │
│       │ userPrompt + systemPrompt                               │
│       ▼                                                         │
│  callLLM() ────────────────► OpenAI API                         │
│       │                           │                             │
│       │                           │ JSON response               │
│       │                           ▼                             │
│       │                      ThreadResultSchema (zod)           │
│       │                           │                             │
│       ▼                           │                             │
│  Character limit validation ◄─────┘                             │
│       │                                                         │
│       │ If violations → retry once with explicit instruction    │
│       ▼                                                         │
│  Return { thread, compliance }                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Involved

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/pages/Threads.tsx` | Main UI: textarea, post count, constraints, generate button, result display |
| `frontend/src/features/threads/hooks/useThreads.ts` | State management: content, postCount, generating, thread result, save logic |
| `frontend/src/features/threads/types.ts` | `ThreadResult`, `SavedThread` interfaces |
| `frontend/src/services/api.ts` | `threadsApi` object with generate/save/list endpoints |
| `frontend/src/app/layout/TabNav.tsx` | Tab navigation including "Threads" tab |

### Backend

| File | Purpose |
|------|---------|
| `backend/src/routes/threads.ts` | Route handlers: POST /generate, POST /save, GET /:projectId |
| `backend/src/prompts/threads.ts` | `getThreadsPrompt(postCount)` - system prompt with 280 char constraints |
| `backend/src/schemas/output-schemas.ts` | `ThreadResultSchema` zod validation |
| `backend/src/services/llm.ts` | `callLLM()` - OpenAI API wrapper with retry logic |
| `backend/src/services/storage.ts` | `saveThread()`, `listThreads()` - file I/O |
| `backend/src/config/llm.ts` | Temperature settings (threads: 0.7) |

---

## Data Structures

### ThreadResult (from LLM)

```typescript
{
  posts: string[];           // Array of tweets, each ≤280 chars
  title?: string;            // Generated title for the thread
  sources?: string[];        // Referenced sources
  compliance: {
    all_under_280: boolean;
    violations?: Array<{
      post_index: number;    // 0-indexed
      char_count: number;
    }>;
  };
}
```

### SavedThread (storage)

```typescript
{
  id: string;                // "thread-{timestamp}-{randomId}"
  title: string;
  posts: string[];
  metadata?: {
    sources?: string[];
    compliance: {...};
  };
  created_at: string;        // ISO timestamp
}
```

### Storage Location

```
/data/projects/{projectId}/threads/
├── thread-1704067200000-abc123.json
├── thread-1704153600000-def456.json
└── ...
```

---

## Thread Generation Prompt

**Location:** `backend/src/prompts/threads.ts`

### Key Constraints

1. **Character limit:** Every post MUST be ≤280 characters (hard requirement)
2. **Post count:** Exactly `{postCount}` posts (user-specified, 1-50)
3. **No emojis/hashtags** unless explicitly requested
4. **No clickbait**, professional tone

### Thread Structure (Narrative Arc)

| Post | Purpose |
|------|---------|
| 1 (Hook) | Bold claim, surprising fact, compelling question |
| 2 (Context) | Why this matters, the stakes |
| 3 to N-2 (Key Points) | One clear idea per post |
| N-1 (Implications) | Broader significance |
| N (Close) | Summary, CTA, or final thought |

### Prompt Excerpt

```
CRITICAL: Every single post MUST be 280 characters or fewer.

Before including ANY post:
1. Draft it
2. Count the characters
3. If over 280, revise it
4. Verify the count again
5. Only then include it
```

---

## API Endpoints

### POST /api/threads/generate

**Request:**
```json
{
  "content": "Full content to convert into a thread...",
  "postCount": 8,
  "constraints": "Include emojis, focus on technical benefits"
}
```

**Response:**
```json
{
  "thread": {
    "posts": ["Post 1...", "Post 2...", "..."],
    "title": "API v2.0 Improvements",
    "compliance": {
      "all_under_280": true,
      "violations": []
    }
  }
}
```

### POST /api/threads/save

**Request:**
```json
{
  "projectId": "my-project",
  "title": "Thread title",
  "posts": ["Post 1", "Post 2", "..."],
  "metadata": { "sources": ["url1"] }
}
```

### GET /api/threads/:projectId

Returns all saved threads for the project, sorted by newest first.

---

## Character Limit Enforcement

The backend has **two-stage validation**:

1. **Initial generation** - LLM generates posts with 280-char instruction
2. **Validation check** - Backend counts each post's characters
3. **Retry if needed** - If violations found, re-prompt with explicit error:
   ```
   The following posts exceed 280 characters:
   - Post 3: 295 chars
   - Post 7: 283 chars

   Rewrite ONLY these posts to be under 280 characters.
   ```

---

## Hook State (useThreads)

```typescript
const {
  // Inputs
  content,          // Raw content to convert
  setContent,
  postCount,        // 1-50, default 8
  setPostCount,
  constraints,      // Optional additional requirements
  setConstraints,

  // Generation
  generating,       // Loading state
  thread,           // ThreadResult | null
  error,            // Error message | null
  handleGenerate,   // Trigger generation

  // Saving
  saveTitle,        // Title for saving
  setSaveTitle,
  saving,           // Saving state
  handleSave,       // Save to project

  // Utilities
  copyAllPosts,     // Copy to clipboard
} = useThreads();
```

---

## UI Components in Threads.tsx

```
┌────────────────────────────────────────────────┐
│  Card                                          │
│  ┌──────────────────────────────────────────┐  │
│  │  Textarea (content input)                │  │
│  │                                          │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  Post Count: [8 ▼]    Constraints: [______]    │
│                                                │
│  [Generate Thread]                             │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  Generated Thread (if thread exists)           │
│  ┌──────────────────────────────────────────┐  │
│  │  Post 1 (280 chars)          [Copy]      │  │
│  ├──────────────────────────────────────────┤  │
│  │  Post 2 (245 chars)          [Copy]      │  │
│  ├──────────────────────────────────────────┤  │
│  │  ...                                     │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [Copy All]  [Save to Project ▼]               │
└────────────────────────────────────────────────┘
```

---

## LLM Configuration for Threads

| Setting | Value |
|---------|-------|
| Model | `gpt-4-turbo` or `gpt-3.5-turbo` (from env) |
| Temperature | 0.7 (creative variation) |
| Max Retries | 1 (for 280-char violations) |
| Max Tokens | Default (not explicitly set) |

---

## What Changes for Articles

To replace threads with articles:

| Component | Thread Behavior | Article Behavior |
|-----------|----------------|------------------|
| **Post structure** | Array of 280-char tweets | Single body with sections |
| **Character limit** | 280 per post | Word count (500-2000?) |
| **Narrative arc** | Hook → Points → Close | Intro → Body → Conclusion |
| **Compliance** | Char count validation | Word/section count |
| **Output format** | `posts: string[]` | `content: string` with markdown |
| **Storage** | `/threads/` directory | `/articles/` directory |
| **UI** | List of copyable posts | Rendered markdown preview |

---

## Files to Modify

### Rename/Refactor

- `pages/Threads.tsx` → `pages/Articles.tsx`
- `features/threads/` → `features/articles/`
- `routes/threads.ts` → `routes/articles.ts`
- `prompts/threads.ts` → `prompts/articles.ts`

### Update

- `app/App.tsx` - Route mapping
- `app/layout/TabNav.tsx` - Tab label
- `services/api.ts` - API endpoints
- `services/storage.ts` - Save/list functions
- `schemas/output-schemas.ts` - New ArticleResultSchema
- `config/llm.ts` - Temperature for articles mode

### New Files (if needed)

- `features/articles/types.ts`
- `features/articles/hooks/useArticles.ts`
