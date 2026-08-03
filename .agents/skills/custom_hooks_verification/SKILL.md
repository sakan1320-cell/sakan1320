---
name: Custom Hooks Verification
description: Instructs the agent to always verify that custom hooks (like useConfirm) are properly invoked and destructured in the component body before their returned values are used in JSX or other functions.
---

# Custom Hooks Verification Skill

## Context
When building React components, we frequently use custom hooks that return specific nodes or functions (e.g., useConfirm returning confirm and ConfirmDialogNode). 
Sometimes, these returned variables are used in JSX (e.g., {ConfirmDialogNode}), but the hook itself is never called inside the component, causing a ReferenceError and crashing the application.

## Rule
Whenever you add, modify, or review a component that imports a custom hook (such as useConfirm from @/components/ui/confirm-dialog):
1. **Verify Hook Invocation:** Ensure the hook is actually called inside the component body.
   `	sx
   // Correct Example:
   export const MyComponent = () => {
     const { confirm, ConfirmDialogNode } = useConfirm();
     
     return (
       <div>
         {ConfirmDialogNode}
       </div>
     );
   }
   `
2. **Verify Returned Variables:** Ensure all destructured variables are correctly spelled and match what is used in the JSX or event handlers.
3. **No Uninitialized Variables in JSX:** Before returning JSX that uses variables like {ConfirmDialogNode}, double-check that they exist in the component scope.
4. **Generalize for similar hooks:** This applies to any custom hooks returning UI nodes or functions (e.g., useToast, useDialog, etc.).
