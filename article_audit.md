# Article Pipeline Audit: User Choices → Author → Council → Revisor

## Scope
This audit traces how user inputs (UI + API config) flow through the article pipeline, and identifies gaps where local knowledge base (KB) files are not used or are effectively overridden by internet data. It also assesses whether the current local file access logic makes sense, and whether additional KB retrieval passes should occur (e.g., re-fetch `kb-index` and entry JSON after draft or revision).

## High-Level Data Flow

### 1) User Choices (Frontend → API)
**Source files:**
- `frontend/src/features/articles/hooks/useArticles.ts`
- `frontend/src/services/api.ts`
- `frontend/src/components/LLMConfigPanel.tsx`
- `frontend/src/pages/Articles.tsx`

**Flow:**
1. User selects `voiceHandle`, optional `projectId`, and writes `content` (topic). Optional `constraints`, `wordCount`, and LLM config (draft/revision model, judges, searchMode, councilMode).
2. `articlesApi.generate()` posts to `POST /api/articles/generate` with:
   - `voiceHandle`, `content`, `wordCount`, `constraints`, `projectId`
   - LLM config: `searchMode`, `draftModel`, `revisionModel`, `judges`, `councilMode`

**Key implication:**
- If user does not select a `projectId`, the KB is never consulted. This is expected behavior and should be surfaced to users more aggressively if “local-first” is desired by default.

### 2) Authoring Stage (Draft Article)
**Source files:**
- `backend/src/routes/articles.ts`
- `backend/src/prompts/articles.ts`
- `backend/src/services/retrieval.ts`
- `backend/src/services/storage.ts`

**Flow:**
1. `routes/articles.ts` receives the request.
2. It loads **example articles** from local cache (`services/voice-analyzer.ts`).
3. If `projectId` is provided, it calls `retrieveRelevantEntries(projectId, topicText)`:
   - Reads `kb-index.md` from `data/projects/<projectId>/kb-index.md` (`readKBIndex()`)
   - Asks an LLM to select relevant entry IDs
   - Loads entry JSON from `data/projects/<projectId>/entries/<entryId>.json`
   - Formats full entry content into a KB “facts” block
4. The **author LLM prompt** (`getClaudeV1Prompt`) includes KB facts as “Verified Knowledge Base Facts” if retrieval succeeded.

**Local KB usage:**
- Used only if `projectId` provided **and** `kb-index.md` exists and retrieval returns entries.
- No fallback if retrieval fails or index is missing (unlike `/assistant` routes).

### 3) Council Stage (Judging & Fact Checks)
**Source files:**
- `backend/src/routes/articles.ts`
- `backend/src/services/council.ts`
- `backend/src/prompts/articles.ts`
- `backend/src/services/multi-llm.ts`

**Flow:**
1. `runCouncil(initialArticle.content, budget, { kbKnowledge, judges, searchMode })`
2. For each judge:
   - If judge has **web search or X search**, `kbKnowledge` is **not passed** to that judge.
   - If judge has **no search**, they get `kbKnowledge`.
3. Judge prompt explicitly says “KB first, then web,” but **KB is missing** for all judges with search enabled.

**Local KB usage:**
- **Inverted priority:** The judges most likely to check facts (fact-checker + slop-detector) are the ones **not given KB** if search is enabled.
- This causes web/internet data to have an “edge” over local KB, even though the prompt declares KB as ground truth.

### 4) Revisor Stage (Final Article)
**Source files:**
- `backend/src/routes/articles.ts`
- `backend/src/prompts/articles.ts`

**Flow:**
1. If council requires revision, `getClaudeFinalPrompt()` is used.
2. The final revision prompt includes:
   - Original article
   - Consensus and priority fixes
   - Flagged phrases
   - Example article (voice reference)
3. **No KB facts** are passed into the revision prompt.

**Local KB usage:**
- **None.** This stage can drift from KB facts, especially if council feedback was based on web-only checks.

### 5) Revise Endpoint (User-Initiated Revision)
**Source files:**
- `backend/src/routes/articles.ts`

**Flow:**
- `POST /api/articles/:articleId/revise` has two modes:
  1. **Quick edit** (`preserveDebate=true`): no KB
  2. **Full re-council** (`preserveDebate=false`): re-runs council with **no KB** and **no projectId**

**Local KB usage:**
- **None in either path.** This is a strong source of local data loss after the initial draft.

## Key Problems & Root Causes

### 1) KB is skipped for judges with web/X search
**Files:** `backend/src/services/council.ts`, `backend/src/prompts/articles.ts`

**Issue:**
- Judges with `useWebSearch`/`useXSearch` do not receive `kbKnowledge` at all.
- Prompt states “KB facts take precedence,” but that’s impossible if KB isn’t provided.

**Impact:**
- Internet data overrides local KB by design.
- Mismatches are likely, especially if KB contains project-specific truths that diverge from public sources.

---

### 2) No KB fallback if retrieval fails (articles only)
**Files:** `backend/src/routes/articles.ts`, `backend/src/services/retrieval.ts`

**Issue:**
- If `kb-index.md` is empty or retrieval fails, article generation uses **zero** KB.
- This differs from `/assistant` where fallback loads all entries.

**Impact:**
- “Local files not loaded at all” is likely when KB index is missing or the retrieval LLM fails.

---

### 3) Retrieval query can be empty or weak for non-topic requests
**Files:** `backend/src/routes/articles.ts`

**Issue:**
- `topicText` = `content || articleRequest.topic || ''`
- If request type is `points`, `draft`, or `full` without a `topic`, retrieval query is empty.

**Impact:**
- Retrieval may return irrelevant entries or none at all, leading to no KB use.

---

### 4) Revision stage omits KB entirely
**Files:** `backend/src/prompts/articles.ts`, `backend/src/routes/articles.ts`

**Issue:**
- Final revision prompt does not include KB facts.
- Judges may have used web-only data; revisor cannot reconcile with KB.

**Impact:**
- Revisions can drift away from local truth, even if draft was grounded in KB.

---

### 5) Re-council revisions drop KB and project context
**Files:** `backend/src/routes/articles.ts`

**Issue:**
- Re-council uses `runCouncil(claudeResult.data.content, budget)` **without** `kbKnowledge`.
- `projectId` is not persisted in article metadata, so KB is unavailable even if original was grounded.

**Impact:**
- Local KB is silently discarded on any user-initiated revise that re-runs council.

---

### 6) KB index is the single point of truth for retrieval, but it is shallow
**Files:** `backend/src/services/kb-compiler.ts`, `backend/src/services/retrieval.ts`

**Issue:**
- KB index contains only `title` and `tags`.
- Retrieval relies on an LLM selecting entries from this sparse index.

**Impact:**
- High miss rate for relevant entries, especially if titles are ambiguous.

## Findings on Local File Access

### Current Access Pattern
- **Index:** `data/projects/<projectId>/kb-index.md`
- **Entries:** `data/projects/<projectId>/entries/<entryId>.json`
- **KB markdown:** `data/projects/<projectId>/kb.md` exists in storage API but is not actively used for articles.

### Observations
- The flow is **index → entry JSON** (RAG-style), but only if retrieval succeeds.
- There is no “second pass” over local KB after draft or after revisions.
- Revisions discard KB entirely.

### Does it make sense?
- **Partially:** The index-then-entry flow is efficient and reasonable for first-pass retrieval.
- **But:** For critical truth grounding and fact-checking, this is insufficient without:
  1. Fallback to full entries when retrieval fails.
  2. Ensuring judges always have KB context.
  3. Re-checking KB after revisions.

## Recommendation: Additional KB Passes

Based on the observed logic, it is reasonable to add **one more KB retrieval pass**:

1. **After draft completion (before council):**
   - Re-run retrieval using the **draft content** (not just the topic) to pull more relevant KB entries.
   - This is a stronger query than the raw topic and can surface missing facts.

2. **Before final revision:**
   - Provide the KB context again so the revisor can preserve or correct factual grounding.

3. **During re-council revisions:**
   - Reuse stored `projectId` in article metadata and load KB again.

These changes would align with your intuition: **KB index → entry JSON, then repeat after the article is produced** to ensure final outputs remain local-first.

## Clarifications: Fix #1 vs #3, and What #2 Means

### Fix #1 vs Fix #3 (Not the Same)
- **Fix #1 (Always pass KB to judges)** changes *who sees KB* during council evaluation. It ensures judges can compare claims against local KB even when they also have web/X search enabled. This addresses the **“internet overrides KB”** issue during evaluation.
- **Fix #3 (Second retrieval pass using draft content)** changes *when KB is retrieved*. It improves recall by re-querying the KB after the draft exists, because the draft contains concrete terms and claims not present in the original topic. This addresses the **“KB not loaded or missing relevant entries”** issue.

Short version:
- **#1 = evaluation stage fix (KB visibility).**
- **#3 = retrieval stage fix (KB coverage).**

### What Fix #2 Means (Persist `projectId`)
- Right now, **revisions do not know which project the article came from**. The article JSON saved to disk does not include `projectId`.
- That means `POST /api/articles/:id/revise` (both quick edits and re-council) **cannot reload KB** even if the original article was KB-grounded.
- **Fix #2 = store `projectId` inside the saved ArticleResult** (e.g., in `ArticleResult` schema + saved JSON). Then revisions can reload KB using that stored projectId.

Why it matters:
- Without it, **any revision silently drops local KB** forever, even if the first draft used it.

## Concrete Fix Targets (Summary)

1. **Always pass KB to judges, even if web/X search is enabled.**
   - Current behavior in `backend/src/services/council.ts` drops KB entirely when search is enabled.

2. **Add fallback to full KB when retrieval fails in articles.**
   - Mirror the logic used in `backend/src/routes/assistant.ts`.

3. **Use richer retrieval queries for non-topic requests.**
   - If request includes `points` or `draft`, include those in the retrieval query.

4. **Include KB in final revision prompt.**
   - Update `getClaudeFinalPrompt` to include “Verified KB Facts.”

5. **Persist `projectId` in ArticleResult for revisions.**
   - So re-council and quick revisions can reload KB.

6. **Re-run retrieval using the draft content.**
   - Optionally as a second pass after the initial draft, before council.

---

## Quick Diagnostic Checklist

- If KB seems ignored:
  - Was `projectId` selected in the UI?
  - Does `data/projects/<projectId>/kb-index.md` exist and contain entries?
  - Do `entries/*.json` contain `full_content`?
  - Is `searchMode` set to `full` (default) causing judges to bypass KB?

---

## Closing Note
The current logic **does not actually enforce “local-first”**. It only provides KB to a subset of judges, and never to the revisor. That aligns with the behavior you observed: internet data has an edge, and local files are sometimes ignored entirely. The fixes above are minimal, targeted, and would significantly improve local file respect and consistency across the pipeline.
