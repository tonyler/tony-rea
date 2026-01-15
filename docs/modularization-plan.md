# Frontend Modularization Plan

## Goals
- Make the frontend resilient to low-skill or inconsistent changes (including LLM-generated edits).
- Isolate concerns so changes are localized and unlikely to break unrelated behavior.
- Establish simple, enforceable boundaries and patterns.

## Guiding Principles (LLM-Resilient)
1. Small files, single responsibility. One component per file; avoid mega-components.
2. Pure rendering components by default. State + effects live in hooks or controllers.
3. Explicit APIs between layers. Types exported from `types/`, no implicit shapes.
4. Stable module boundaries. Do not import across feature boundaries except via index barrels.
5. Predictable file structure. Repeated patterns per feature reduce accidental edits.
6. Defensive defaults. Guard nulls and empty states in shared components.

## Target Structure
```
frontend/src/
  app/
    App.tsx
    routes.ts
    layout/
      AppLayout.tsx
      Header.tsx
      TabNav.tsx
  features/
    assistant/
      api.ts
      types.ts
      hooks/
        useAssistant.ts
      components/
        AssistantPage.tsx
        ModeSelector.tsx
        ResultPanel.tsx
        ContextToggle.tsx
    feed/
      api.ts
      types.ts
      hooks/
        useFeed.ts
      components/
        FeedPage.tsx
        IngestForm.tsx
        EntriesList.tsx
        EntryUpdateForm.tsx
        KBView.tsx
    threads/
      api.ts
      types.ts
      hooks/
        useThreads.ts
      components/
        ThreadsPage.tsx
        ThreadForm.tsx
        ThreadResult.tsx
        ThreadSaveForm.tsx
  shared/
    api/
      client.ts
    components/
      Button.tsx
      Card.tsx
      CopyButton.tsx
      LoadingSpinner.tsx
      ProjectSelector.tsx
      ErrorBanner.tsx
    hooks/
      useAsync.ts
    types/
      index.ts
  styles/
    index.css
```

## Phase 0: Safety Rails (no behavior changes)
- Add a `README.md` in `frontend/src/` that documents the structure and rules.
- Add a `CONTRIBUTING.md` entry for “Do not mix API/state/UI in page components.”

## Phase 1: Shared API Client
Goal: Single fetch wrapper and error handling.
- Create `shared/api/client.ts` exporting `request<T>()`.
- Move existing API base URL and error handling from `frontend/src/services/api.ts`.
- Make `features/*/api.ts` files depend on the shared client.

## Phase 2: Feature-Local Types
Goal: Avoid cross-feature type entanglement.
- Split `frontend/src/types/index.ts` into:
  - `features/assistant/types.ts`
  - `features/feed/types.ts`
  - `features/threads/types.ts`
  - `shared/types/index.ts` (Project, common types only)
- Update imports to use feature-local types only.

## Phase 3: Extract Feature Hooks
Goal: Move state + effects out of page components.
- Assistant:
  - Create `useAssistant` handling mode, submit, loading, error, result.
- Feed:
  - Create `useFeed` handling view state, ingest, list, update, delete.
- Threads:
  - Create `useThreads` handling generation, save, and copy.

## Phase 4: Break Pages into Subcomponents
Goal: Each major UI block is a component.
- Assistant:
  - `ModeSelector`, `ContextToggle`, `ResultPanel`.
- Feed:
  - `IngestForm`, `EntriesList`, `EntryUpdateForm`, `KBView`.
- Threads:
  - `ThreadForm`, `ThreadResult`, `ThreadSaveForm`.

## Phase 5: Layout Isolation
Goal: Keep App layout and navigation stable.
- Move header and tabs from `App.tsx` into `app/layout/`.
- `App.tsx` renders `AppLayout` and a feature page.

## Phase 6: Shared UI Hardening
Goal: Make shared components safe for incorrect usage.
- Add prop defaults and runtime guards (e.g., empty arrays, null labels).
- Add `ErrorBanner` and use it across features.
- Standardize on `Button` variants and `Card` variants.

## Phase 7: LLM-Proofing Rules
Goal: Make accidental edits non-breaking.
- Create a `frontend/src/LLM_RULES.md` with:
  - Do not edit shared components for feature-specific styling.
  - No cross-feature imports.
  - Page components only compose feature components + hooks.
  - Feature APIs should not access DOM or browser APIs.

## Suggested Sequencing
1. Phase 1 (client extraction)
2. Phase 2 (types split)
3. Phase 3 (hooks)
4. Phase 4 (components)
5. Phase 5 (layout)
6. Phase 6 (UI hardening)
7. Phase 7 (rules)

## Minimal Acceptance Checks
- TypeScript compiles with no `any` introduced.
- Each feature folder has its own `api.ts`, `types.ts`, `hooks/`, `components/`.
- `App.tsx` contains only layout + route selection.
- No imports between `features/*` folders.

## Notes
- Keep file names stable and explicit to reduce confusion.
- Prefer duplication of small UI strings over coupling features.
- Avoid smart global state unless necessary.
