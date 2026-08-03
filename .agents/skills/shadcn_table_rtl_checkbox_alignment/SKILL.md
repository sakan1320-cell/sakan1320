---
name: shadcn_table_rtl_checkbox_alignment
description: Instructs the agent on how to correctly align and center Checkbox components inside Shadcn UI Tables in RTL (Right-to-Left) layouts.
---

# Shadcn UI Table Checkbox Alignment in RTL

When building tables using Shadcn UI in an RTL (Right-to-Left) application, the default `TableCell` and `TableHead` components have specific styles that break the centering of `Checkbox` components.

## The Problem
Shadcn's `TableCell` and `TableHead` components apply a CSS rule for cells containing a checkbox:
`[&:has([role=checkbox])]:pr-0`

In an RTL environment, `pr-0` removes the right padding, but the left padding (`pl-4` from `px-4` or `p-4`) remains. This pushes the checkbox significantly to the right side of the cell, preventing it from being centered.

## The Solution
Whenever you add a `Checkbox` to a Shadcn `Table` (`TableHead` or `TableCell`) and the user expects it to be centered, you MUST override the default padding by applying `p-0` to the cell and centering the content inside a flex container.

### Correct Implementation:

```tsx
<TableCell className="p-0 text-center align-middle">
  <div className="flex justify-center items-center w-full h-full">
    <Checkbox
      className="rounded-full h-5 w-5" // Optional: rounded-full for circular checkboxes
      checked={isChecked}
      onCheckedChange={handleCheck}
    />
  </div>
</TableCell>
```

**Rule:** Always use `p-0` on the wrapper `<TableCell>` or `<TableHead>` when rendering a centered `<Checkbox>` in an RTL table.
