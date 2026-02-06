# TODO (article generation debugging)

1. Fix council crash when all judges fail (empty opinions).
   - Guard against empty `opinionList` in `mergeDebateRound`.
   - Ensure `runCouncil` returns a safe empty round instead of throwing.
   Files: `backend/src/services/council.ts`

2. Fix misleading "early stop" UI.
   - Add explicit `earlyStop` / `skipFinalRevision` to ArticleResult.
   - Use it in UI instead of `!r2`.
   Files: `backend/src/routes/articles.ts`, `backend/src/schemas/article-result.ts`, `frontend/src/pages/Articles.tsx`, `frontend/src/pages/ArticleHistory.tsx`, `frontend/src/components/DebateViewer.tsx`

3. Re-council revision should include flagged phrases in final revision prompt.
   - Pass `flaggedPhrases` into `getClaudeFinalPrompt(...)` in re-council path.
   Files: `backend/src/routes/articles.ts`

4. Fix empty KB retrieval query for non-topic requests.
   - Build retrieval query from request `points`, `draft`, or full content when `topic` is missing.
   Files: `backend/src/routes/articles.ts`

5. Persist `projectId` in ArticleResult so revisions can reload KB.
   - Store `projectId` when saving.
   - Use stored `projectId` in revise endpoint to reload KB.
   Files: `backend/src/routes/articles.ts`, `backend/src/schemas/article-result.ts`

6. Surface council warnings from `runCouncil`.
   - Return warnings produced during judge config/build.
   Files: `backend/src/services/council.ts`

7. Align example article schema between backend and frontend.
   - Add `datePosted` to frontend type or remove it from backend schema.
   Files: `backend/src/schemas/article-result.ts`, `frontend/src/features/articles/types.ts`
