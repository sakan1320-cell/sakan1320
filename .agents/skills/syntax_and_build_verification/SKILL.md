---
name: syntax_and_build_verification
description: Instructs the agent to always verify syntax and build integrity after making code modifications using file edit tools.
---

# Syntax and Build Verification Skill

## Objective
To prevent breaking the application's build and causing the development server to crash due to syntax errors, missing braces, or incorrect file modifications.

## Rules
1. **Always Verify Edits**: After using tools like `replace_file_content` or `multi_replace_file_content` to modify `.ts` or `.tsx` files, you MUST run a verification check.
2. **Run Build Process**: Use the `run_command` tool to execute `npm run build`. 
   - `npx tsc --noEmit` is NOT enough for React (Vite/esbuild) as it may not catch unbalanced JSX tags which crash the bundler. You must run `npm run build` to catch all syntax, type, and JSX parsing errors.
3. **Do Not Skip Verification**: Even for small, seemingly trivial edits, the verification step is mandatory. Missing a single closing tag `</div>` or brace `}` can crash the entire frontend development server for the user.
4. **Fix Before Continuing**: If `npm run build` fails, you must immediately read the error output and fix the errors before presenting the changes to the user or considering the task complete.
