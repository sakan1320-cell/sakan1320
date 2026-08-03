---
name: "simple_url_inputs"
description: "Instructs the agent to make URL input fields extremely simple for end users, avoiding complex instructions and handling formatting automatically behind the scenes."
---

# Simple URL Inputs

## Context
General users and administrators often find complex URL formatting (like relative vs. absolute paths, or required protocols) confusing. They simply want to copy a link from their browser and paste it into the field.

## Rule
Whenever creating or modifying an input field for a URL (e.g., social media links, button links, action URLs):
1. **No Complex Instructions:** Do not show complex instructions to the user about how the link should be formatted (e.g., "Must start with /", "Use relative paths for internal links").
2. **Simple Placeholders:** Use simple, universally understood placeholders like `https://example.com` or `www.example.com`.
3. **Auto-formatting (Behind the Scenes):** If the system requires a specific format (like a full URL or a relative path), write code to handle the user's input automatically (e.g., adding `https://` if they only pasted `example.com`, or keeping it as is if it's already a full link).
4. **Forgiving Validation:** Do not block the user with strict regex errors unless absolutely necessary. Be forgiving and auto-correct common mistakes.

**Example (React):**
```tsx
const handleLinkChange = (e) => {
  let value = e.target.value.trim();
  // Auto-correct behind the scenes if they forgot https:// and it's not a relative internal link
  if (value && !value.startsWith('http') && !value.startsWith('/')) {
    value = `https://${value}`;
  }
  setLink(value);
};

// UI - Clean and simple
<Input 
  type="url" 
  placeholder="https://example.com" 
  onChange={handleLinkChange} 
  dir="ltr"
/>
```
