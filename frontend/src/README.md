# Frontend Architecture

## Overview

The Tony & Rea frontend follows a modular, feature-based architecture designed to be resilient to partial understanding, incomplete edits, and AI-assisted changes.

## Directory Structure

```
src/
  app/                      # Application shell
    App.tsx                 # Root component
    layout/                 # Layout components
      AppLayout.tsx         # Main layout composition
      Header.tsx            # App header
      TabNav.tsx            # Tab navigation

  features/                 # Feature modules (isolated)
    assistant/              # Moderator assistant feature
      api.ts                # API calls
      types.ts              # Feature-specific types
      hooks/                # State management hooks
      components/           # UI components

    feed/                   # Knowledge base feed feature
      api.ts
      types.ts
      hooks/
      components/

    threads/                # Thread generation feature
      api.ts
      types.ts
      hooks/
      components/

  shared/                   # Shared utilities
    api/                    # Shared API utilities
      client.ts             # Request wrapper
    components/             # Reusable UI components
    types/                  # Shared type definitions

  pages/                    # Page entry points (re-exports from features)

  main.tsx                  # Application entry point
  index.css                 # Global styles
```

## Core Principles

### 1. Feature Isolation
Each feature is self-contained with its own API, types, hooks, and components. Features do not import from each other.

**Structure:**
```
features/[feature-name]/
  api.ts          - API calls only, no state or DOM
  types.ts        - Feature-specific TypeScript types
  hooks/          - State management and business logic
  components/     - UI components for this feature
```

### 2. Clear Layer Separation
- **API Layer** (`api.ts`): Pure API calls, no state or side effects
- **State Layer** (`hooks/`): State management, effects, business logic
- **UI Layer** (`components/`): Rendering and user interaction
- **Types Layer** (`types.ts`): TypeScript interfaces and types

### 3. Shared Resources
Shared components and utilities are defensive and generic:
- Handle `null`/`undefined` props gracefully
- Provide sensible defaults
- No feature-specific logic

### 4. Explicit Boundaries
- Import from index barrels only (`shared/components`, not `shared/components/Button`)
- No cross-feature imports
- Types are co-located with features

## Rules for Editing

### ✅ DO:
- Keep one component per file
- Extract state and effects into hooks
- Use shared components for common UI patterns
- Import from barrel exports (index.ts files)
- Handle edge cases (null, undefined, empty arrays)
- Make page components simple compositions of hooks + UI

### ❌ DO NOT:
- Import from one feature into another feature
- Modify shared components for feature-specific needs
- Put API calls directly in page components
- Mix business logic with rendering
- Create mega-components with multiple responsibilities
- Skip TypeScript types or use `any`

## Import Guidelines

**Good:**
```typescript
// Import from shared components
import { Button, Card } from '../../shared/components';

// Import feature-local types
import type { AssistantResponse } from '../types';

// Use feature hooks
import { useAssistant } from '../hooks/useAssistant';
```

**Bad:**
```typescript
// Don't import across features
import type { Entry } from '../../feed/types';  // ❌

// Don't skip barrel exports
import Button from '../../shared/components/Button';  // ❌

// Don't import hooks from other features
import { useFeed } from '../../feed/hooks/useFeed';  // ❌
```

## Component Guidelines

### Page Components
Page components should be thin wrappers that:
- Use feature hooks for state/logic
- Compose subcomponents
- Handle layout and routing

**Example:**
```typescript
export default function AssistantPage() {
  const assistant = useAssistant();

  return (
    <div>
      <ModeSelector mode={assistant.mode} onModeChange={assistant.setMode} />
      <ResultPanel result={assistant.result} />
    </div>
  );
}
```

### Feature Subcomponents
Break down complex UIs into focused components:
- Each component has a single purpose
- Props are explicit and typed
- No direct API calls

### Shared Components
Must be defensive and generic:
- Handle missing/null props
- Provide default values
- No feature-specific logic
- Work correctly with incorrect usage

## State Management

State lives in custom hooks:
- One hook per feature (e.g., `useAssistant`, `useFeed`)
- Hooks encapsulate all state, effects, and handlers
- Components receive data and callbacks via hook return values

## Type Organization

- **Shared types** (`shared/types/`): Used by multiple features (e.g., `Project`)
- **Feature types** (`features/*/types.ts`): Used only within that feature
- **No cross-feature type dependencies**

## Testing Your Changes

After making changes, verify:

```bash
# TypeScript compilation
npm run build

# Type checking
npx tsc --noEmit

# Dev server
npm run dev
```

Manual testing checklist:
- [ ] Navigate to each tab
- [ ] Submit forms in each feature
- [ ] Check browser console for errors
- [ ] Verify API calls work
- [ ] Test error states

## Important Files

- **LLM_RULES.md**: Detailed editing rules for AI-assisted coding
- **CONTRIBUTING.md**: General contribution guidelines

## Questions?

When making changes, ask yourself:
1. Am I editing a shared component? Is this needed by ALL features?
2. Am I importing from another feature? Should this be shared?
3. Am I adding state to a page component? Should this be in a hook?
4. Am I calling APIs directly from a component? Should this use the feature's api.ts?

For detailed anti-patterns and recovery procedures, see [LLM_RULES.md](./LLM_RULES.md).
