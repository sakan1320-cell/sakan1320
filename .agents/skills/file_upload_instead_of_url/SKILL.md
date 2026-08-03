---
name: "file_upload_instead_of_url"
description: "Instructs the agent to always use file upload inputs (<input type='file'>) instead of text inputs for URLs when dealing with images, videos, or any other files."
---

# File Upload Instead of URL

## Context
When building interfaces, forms, or settings pages that require the user to provide an image, video, document, or any other file, it is a common mistake to use a simple text input (`<input type="text" />`) that asks the user to provide a URL to the file.

## Rule
**NEVER** ask the user to provide a URL link for an image, video, or file.
**ALWAYS** use a file picker (`<input type="file" />`) that allows the user to import the file directly from their device.

## Implementation Guidelines
1. Provide a standard file input: `<input type="file" accept="image/*" />` (adjust `accept` attribute based on file type).
2. Handle the file locally using a `FileReader` to convert it to a Base64 string for immediate preview and saving, OR upload it securely to a storage bucket (e.g., Supabase Storage) and use the returned URL.
3. Ensure you provide UI feedback during the upload process (e.g., a loading spinner).
4. Provide a way to preview the uploaded file and a button to remove it.

**Example (React):**
```tsx
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  // Convert to Base64 or upload to server
  const reader = new FileReader();
  reader.onload = () => setFileUrl(reader.result as string);
  reader.readAsDataURL(file);
};

// UI
<input type="file" accept="image/*" onChange={handleFileUpload} />
```
