# Contributing to Tony & Rea

Thank you for contributing to the Tony & Rea project! This document provides guidelines for contributing to the codebase.

## Frontend Guidelines

The frontend follows a modular, feature-based architecture designed to be resilient to incomplete edits and AI-assisted changes.

### Before Editing Frontend Code

**IMPORTANT: Read these files first:**
- `/frontend/src/README.md` - Architecture overview and structure
- `/frontend/src/LLM_RULES.md` - Detailed editing rules and anti-patterns

### Frontend Architecture Principles

1. **Features are isolated** - No cross-feature imports
2. **Shared components are defensive** - Handle null/undefined gracefully
3. **Business logic lives in hooks** - Not in components
4. **Types are co-located with features** - Except shared types

### Common Mistakes to Avoid

#### ❌ DO NOT: Mix API/State/UI in Page Components

**Bad:**
```typescript
export default function AssistantPage() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const response = await fetch('/api/assistant/mod', ...);  // API call in component
    // ...
  };
}
```

**Good:**
```typescript
export default function AssistantPage() {
  const assistant = useAssistant();  // Hook handles state and API

  return <form onSubmit={assistant.handleSubmit}>...</form>;
}
```

#### ❌ DO NOT: Import Across Feature Boundaries

**Bad:**
```typescript
// In features/assistant/components/AssistantPage.tsx
import type { Entry } from '../../feed/types';  // Cross-feature import
```

**Good:**
```typescript
// In features/assistant/types.ts
// Duplicate the type if needed, or move to shared/types if truly shared
export interface Entry { ... }
```

#### ❌ DO NOT: Modify Shared Components for Feature-Specific Needs

**Bad:**
```typescript
// In shared/components/Button.tsx
interface ButtonProps {
  assistantMode?: boolean;  // Feature-specific prop
}
```

**Good:**
```typescript
// In features/assistant/components/AssistantButton.tsx
function AssistantButton({ mode, ...props }) {
  return <Button className={`assistant-${mode}`} {...props} />;
}
```

### Frontend File Structure

```
frontend/src/
  app/                  # Application shell and layout
  features/             # Feature modules (assistant, feed, threads)
    [feature]/
      api.ts            # API calls only
      types.ts          # Feature-specific types
      hooks/            # State management
      components/       # UI components
  shared/               # Shared utilities and components
    api/                # Shared API utilities
    components/         # Reusable UI components
    types/              # Shared types
  pages/                # Page entry points
```

### Making Changes

1. **Identify the correct layer:**
   - API changes → `features/*/api.ts`
   - Type changes → `features/*/types.ts` or `shared/types/`
   - State/logic changes → `features/*/hooks/`
   - UI changes → `features/*/components/`

2. **Follow existing patterns:**
   - Look at similar components/hooks in the same feature
   - Match the code style and structure
   - Use the same import patterns

3. **Test your changes:**
   ```bash
   npm run build          # TypeScript compilation
   npx tsc --noEmit      # Type checking
   npm run dev           # Dev server
   ```

4. **Verify manually:**
   - Navigate to affected pages
   - Test all user interactions
   - Check console for errors
   - Verify API calls work

### Getting Help

- Read `/frontend/src/LLM_RULES.md` for detailed guidelines
- Review existing code in the same feature
- Ask questions before making large architectural changes

## General Development Guidelines

### Code Style

- Use TypeScript with strict mode
- Follow existing naming conventions
- Write clear, descriptive variable names
- Add comments only for complex logic

### Commits

- Write clear, descriptive commit messages
- Use conventional commit format when possible
- Commit logical units of work
- Test before committing

### Pull Requests

- Describe what changed and why
- Reference related issues
- Ensure all tests pass
- Update documentation if needed

## Questions?

If you're unsure about:
- Where code should go
- How to structure a change
- Whether something violates architecture rules

Please ask before making the change. It's better to clarify upfront than to redo work later.

---

Thank you for contributing!
