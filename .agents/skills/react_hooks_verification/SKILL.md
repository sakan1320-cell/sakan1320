---
name: React Hooks Import Verification
description: "Instructs the agent to always verify and include necessary React hook imports (e.g., useState, useEffect) when adding hooks to a component."
---

# React Hooks Import Verification Rule

## Context
When modifying React components, agents often add hooks like `useState`, `useEffect`, `useContext`, `useMemo`, `useCallback`, etc., but occasionally forget to import them at the top of the file. This leads to severe runtime crashes such as `ReferenceError: useEffect is not defined`.

## Instructions
1. **Always Verify Imports**: Before applying any changes that introduce a new React hook into a file, you MUST explicitly check the `import` statements at the top of that file.
2. **Add Missing Imports**: If the hook is not already imported, you MUST include an instruction to update the import statement (e.g., `import { useState, useEffect } from "react";`).
3. **Double Check**: After editing a file, quickly review the diff or your changes to ensure that every hook you used is properly imported.
4. **No Assumptions**: Do not assume that common hooks are already imported just because they are standard. Check every time.

## Example
If you add:
```tsx
const [data, setData] = useState(null);
useEffect(() => { ... }, []);
```
You must ensure the following exists:
```tsx
import { useState, useEffect } from "react";
```
