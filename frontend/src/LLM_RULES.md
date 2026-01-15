# LLM-Proof Editing Rules

These rules are designed to prevent common mistakes when editing this codebase, especially when using AI-assisted coding tools.

## Core Principles

1. **Feature Isolation**: Each feature is self-contained
2. **No Cross-Feature Imports**: Features never import from each other
3. **Shared Components Are Sacred**: Don't modify shared components for feature-specific needs
4. **Types Follow Features**: Types live with the features that use them

## Forbidden Actions

### ❌ DO NOT: Import Across Feature Boundaries

**Bad:**
```typescript
// In features/assistant/components/AssistantPage.tsx
import type { Entry } from '../../feed/types';  // ❌ Cross-feature import
import { useFeed } from '../../feed/hooks/useFeed';  // ❌ Cross-feature hook import
```

**Good:**
```typescript
// In features/assistant/types.ts
// Duplicate the type if needed, or move to shared/types if truly shared
export interface Entry { ... }

// OR use shared types
import type { Project } from '../../shared/types';
```

**Why?** Cross-feature imports create tight coupling and make features dependent on each other. If one feature changes, it breaks others.

### ❌ DO NOT: Modify Shared Components for Feature-Specific Needs

**Bad:**
```typescript
// In shared/components/Button.tsx
interface ButtonProps {
  assistantMode?: boolean;  // ❌ Feature-specific prop
  feedView?: 'ingest' | 'entries';  // ❌ Feature-specific prop
}
```

**Good:**
```typescript
// In features/assistant/components/AssistantButton.tsx
function AssistantButton({ mode, ...props }: AssistantButtonProps) {
  return <Button className={`assistant-${mode}`} {...props} />;
}
```

**Why?** Shared components must remain generic. Feature-specific logic pollutes shared code and makes it harder to maintain.

### ❌ DO NOT: Put Business Logic in Page Components

**Bad:**
```typescript
// In pages/Assistant.tsx
export default function Assistant() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    const response = await fetch('/api/assistant/mod', ...);  // ❌ Direct API call
    setResult(response.data);  // ❌ State management in component
    setLoading(false);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**Good:**
```typescript
// In pages/Assistant.tsx
export default function Assistant() {
  const assistant = useAssistant();  // ✅ Hook handles state and API

  return <form onSubmit={assistant.handleSubmit}>...</form>;
}

// In features/assistant/hooks/useAssistant.ts
export function useAssistant() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    const response = await assistantApi.mod(...);  // ✅ Use API layer
    setResult(response.result);
    setLoading(false);
  };

  return { loading, result, handleSubmit };
}
```

**Why?** Page components should only compose UI. Business logic belongs in hooks where it can be tested and reused.

### ❌ DO NOT: Access DOM or Browser APIs in Feature API Files

**Bad:**
```typescript
// In features/assistant/api.ts
export const assistantApi = {
  mod: async (input: string) => {
    localStorage.setItem('lastInput', input);  // ❌ Browser API in API file
    const response = await request('/assistant/mod', { body: { input } });
    return response;
  }
};
```

**Good:**
```typescript
// In features/assistant/api.ts
export const assistantApi = {
  mod: async (input: string, context?: string, projectId?: string) => {
    return request<{ result: AssistantResponse }>('/assistant/mod', {
      method: 'POST',
      body: JSON.stringify({ userInput: input, context, projectId }),
    });
  }
};

// In features/assistant/hooks/useAssistant.ts
export function useAssistant() {
  const handleSubmit = async () => {
    localStorage.setItem('lastInput', userInput);  // ✅ Side effects in hooks
    const response = await assistantApi.mod(userInput);
    // ...
  };
}
```

**Why?** API files should be pure functions that only handle HTTP requests. Side effects belong in hooks.

### ❌ DO NOT: Skip Barrel Exports (index.ts)

**Bad:**
```typescript
import Button from '../../shared/components/Button';  // ❌ Direct file import
import Card from '../../shared/components/Card';  // ❌ Direct file import
```

**Good:**
```typescript
import { Button, Card } from '../../shared/components';  // ✅ Barrel export
```

**Why?** Barrel exports provide a single import point and make refactoring easier. If file locations change, only the barrel export needs updating.

## Required Patterns

### ✅ DO: Follow Feature Structure

Every feature must have this structure:

```
features/[feature-name]/
  api.ts          - API calls only, no state or DOM access
  types.ts        - Feature-specific TypeScript types
  hooks/          - State management, business logic, effects
    use[Feature].ts
  components/     - UI components for this feature
    [Feature]Page.tsx
    [Component].tsx
```

**Example for assistant feature:**
```
features/assistant/
  api.ts          - assistantApi.mod(), .education(), .grammar()
  types.ts        - AssistantResponse, EducationResponse, GrammarResponse, AssistantMode
  hooks/
    useAssistant.ts
  components/
    AssistantPage.tsx
```

### ✅ DO: Use Hooks for State Management

**Pattern:**
```typescript
// 1. Create hook in features/[name]/hooks/
export function useFeature() {
  const [state, setState] = useState(...);
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    setLoading(true);
    const result = await featureApi.action(...);
    setState(result);
    setLoading(false);
  };

  useEffect(() => {
    // Side effects here
  }, [dependencies]);

  return {
    state,
    loading,
    handleAction,
  };
}

// 2. Use hook in page component
export default function FeaturePage() {
  const feature = useFeature();

  return <div>{feature.loading ? 'Loading...' : feature.state}</div>;
}
```

### ✅ DO: Keep Components Focused

**One component = one responsibility**

**Bad:**
```typescript
// MegaComponent.tsx - 500 lines
export default function MegaComponent() {
  // Form state
  // List state
  // Modal state
  // API calls
  // Effects
  // Rendering everything
}
```

**Good:**
```typescript
// FeaturePage.tsx - 50 lines
export default function FeaturePage() {
  const feature = useFeature();

  return (
    <div>
      <FeatureForm onSubmit={feature.handleSubmit} />
      <FeatureList items={feature.items} />
      {feature.showModal && <FeatureModal />}
    </div>
  );
}
```

### ✅ DO: Handle Null/Undefined in Shared Components

**Pattern:**
```typescript
interface SharedComponentProps {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function SharedComponent({
  children,
  className = '',  // ✅ Default value
  onClick
}: SharedComponentProps) {
  // ✅ Guard against missing children
  if (!children) {
    console.warn('SharedComponent rendered without children');
    return null;
  }

  return (
    <div className={`base-class ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}
```

## File Modification Guidelines

### When to Edit Each Layer

**`shared/components/`** - Only for:
- Bug fixes that affect all features
- Adding new variants that benefit ALL features
- Adding defensive null checks
- **Never** for feature-specific styling or behavior

**`shared/types/`** - Only for:
- Types used by multiple features (e.g., `Project`)
- **Never** for feature-specific types

**`features/[name]/types.ts`** - Freely edit for:
- Types specific to this feature only
- Types used only by this feature's components and hooks

**`features/[name]/api.ts`** - Only for:
- HTTP requests to backend
- **Never** add state, DOM access, or effects

**`features/[name]/hooks/`** - Freely edit for:
- State management
- Business logic
- Effects and side effects
- Calling API functions

**`features/[name]/components/`** - Freely edit for:
- UI rendering
- User interactions
- Composition of hooks and subcomponents

**`app/layout/`** - Only for:
- Global layout changes
- Header, navigation, footer
- **Never** for feature-specific UI

## Testing Your Changes

Before committing, always verify:

```bash
# 1. TypeScript compiles
npm run build

# 2. Type checking passes
npx tsc --noEmit

# 3. Dev server runs
npm run dev
```

**Manual testing checklist:**
- [ ] Navigate to each tab (Assistant, Feed, Threads)
- [ ] Submit a form in each feature
- [ ] Check browser console for errors
- [ ] Verify API calls work (check Network tab)
- [ ] Test error states (disconnect network)

## Questions to Ask Before Editing

### 1. Am I editing a shared component?

**Ask:** Is this change needed by ALL features, or just one?

- If just one feature → Create a feature-specific wrapper
- If all features → Proceed with shared component edit

### 2. Am I importing from another feature?

**Ask:** Should this be in `shared/` instead?

- If used by 2+ features → Move to `shared/types/`
- If only one feature needs it → Duplicate the type

### 3. Am I adding state to a page component?

**Ask:** Should this be in a hook instead?

- If it's business logic or API calls → Move to hook
- If it's just UI state (e.g., dropdown open) → OK in component

### 4. Am I adding API calls to a component?

**Ask:** Should this use the feature's `api.ts`?

- **Always** use `features/[name]/api.ts` for HTTP requests
- Call API functions from hooks, not components

## Common Anti-Patterns

### Anti-Pattern 1: The Mega-Component

**Problem:**
```typescript
// 800-line component with everything mixed together
export default function FeaturePage() {
  // 50 lines of state
  // 100 lines of effects
  // 200 lines of handlers
  // 450 lines of JSX
}
```

**Solution:** Extract hooks and subcomponents
```typescript
export default function FeaturePage() {
  const feature = useFeature();  // State + logic in hook

  return (
    <>
      <FeatureForm {...feature.formProps} />
      <FeatureList {...feature.listProps} />
    </>
  );
}
```

### Anti-Pattern 2: Prop Drilling

**Problem:**
```typescript
<Parent>
  <Child user={user} theme={theme} settings={settings}>
    <GrandChild user={user} theme={theme} settings={settings}>
      <GreatGrandChild user={user} theme={theme} settings={settings} />
    </GrandChild>
  </Child>
</Parent>
```

**Solution:** Use hooks or context
```typescript
// Create a hook
export function useAppState() {
  const [user, setUser] = useState(...);
  const [theme, setTheme] = useState(...);
  return { user, theme };
}

// Use in any component
function GreatGrandChild() {
  const { user, theme } = useAppState();
}
```

### Anti-Pattern 3: Implicit Dependencies

**Problem:**
```typescript
// Component relies on global state or context not explicitly passed
function Component() {
  const data = useContext(SomeContext);  // Hidden dependency
  return <div>{data}</div>;
}
```

**Solution:** Make dependencies explicit
```typescript
interface ComponentProps {
  data: DataType;  // Explicit prop
}

function Component({ data }: ComponentProps) {
  return <div>{data}</div>;
}
```

## Recovery from Mistakes

If you accidentally break the architecture:

1. **Revert the change**
   ```bash
   git checkout -- path/to/file.tsx
   ```

2. **Identify which principle was violated**
   - Cross-feature import?
   - Business logic in component?
   - Feature-specific code in shared component?

3. **Find the correct layer for your change**
   - API logic → `features/[name]/api.ts`
   - State + effects → `features/[name]/hooks/`
   - UI rendering → `features/[name]/components/`
   - Shared utilities → `shared/`

4. **Re-implement following the patterns above**

## Examples of Correct Changes

### Example 1: Adding a New Feature Field

**Goal:** Add "priority" field to assistant mode

**Correct approach:**
```typescript
// 1. Add type in features/assistant/types.ts
export type AssistantPriority = 'low' | 'medium' | 'high';

export interface AssistantRequest {
  userInput: string;
  priority?: AssistantPriority;  // ✅ New field
}

// 2. Update API in features/assistant/api.ts
export const assistantApi = {
  mod: (input: string, priority?: AssistantPriority) => {
    return request('/assistant/mod', {
      body: JSON.stringify({ userInput: input, priority }),
    });
  }
};

// 3. Update hook in features/assistant/hooks/useAssistant.ts
export function useAssistant() {
  const [priority, setPriority] = useState<AssistantPriority>('medium');

  const handleSubmit = async () => {
    const response = await assistantApi.mod(userInput, priority);
    // ...
  };

  return { priority, setPriority, handleSubmit };
}

// 4. Update component in features/assistant/components/AssistantPage.tsx
export default function AssistantPage() {
  const assistant = useAssistant();

  return (
    <form onSubmit={assistant.handleSubmit}>
      <select value={assistant.priority} onChange={(e) => assistant.setPriority(e.target.value)}>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </form>
  );
}
```

### Example 2: Adding a Shared Utility

**Goal:** Create a date formatting utility

**Correct approach:**
```typescript
// 1. Create in shared/utils/date.ts (create utils folder)
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// 2. Export from shared/utils/index.ts
export { formatDate } from './date';

// 3. Use in any feature
import { formatDate } from '../../shared/utils';

const formattedDate = formatDate(entry.created_at);
```

## Summary

Remember: These patterns exist to make the codebase resilient to partial understanding and incomplete context.

**The three golden rules:**
1. **Features are islands** - No cross-feature imports
2. **Shared is sacred** - Only generic code in shared/
3. **Hooks hold state** - Components only render

When in doubt, follow existing patterns in the codebase. Look at how other features are structured and match that approach.

---

For questions or clarifications, refer to `/frontend/src/README.md` or ask the team.
