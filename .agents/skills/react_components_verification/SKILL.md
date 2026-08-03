---
name: React Components and Icons Verification
description: Instructs the agent to always verify and include necessary React component imports, especially Lucide icons and Shadcn UI components, to prevent runtime crashes.
---

# React Components and Icons Verification

When adding, modifying, or moving JSX code within a React component, you must **always** perform the following verification steps before concluding your changes:

1. **Verify Lucide Icons:** 
   - Check every single icon you added (e.g., `<Zap />`, `<PlusCircle />`, `<Star />`).
   - Ensure it is explicitly imported from `lucide-react` at the top of the file.
   - *Example: `import { Zap, PlusCircle } from "lucide-react";`*

2. **Verify UI Components (Shadcn/Radix):**
   - Check every UI component you used (e.g., `<Dialog>`, `<DialogTrigger>`, `<DialogContent>`, `<Card>`, `<CardContent>`).
   - Ensure the exact component is imported from the correct `@/components/ui/...` path.
   - Missing sub-components (like `DialogTrigger`) will crash the page just like missing icons.

3. **Validate the File:**
   - Always run `npm run lint` or check TypeScript (`npx tsc --noEmit`) if you made structural changes.
   - If you inject raw code strings (e.g., using replace scripts), manually verify the resulting file for undefined variables.

**Why this is critical:**
React does not tolerate undefined variables in JSX (e.g., `<UndefinedComponent />`). It will instantly crash the entire page at runtime with "Element type is invalid". This skill ensures you act smartly and proactively prevent these runtime crashes.
