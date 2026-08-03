---
name: excel_templates_arabic_rtl
description: Instructs the agent on how to correctly generate and read Excel templates with Arabic RTL support, data validation without separate list sheets, and proper mapping.
---

# Arabic RTL Excel Templates Generation & Processing

When tasked with generating or processing Excel export/import templates in Sakansa, you **MUST** strictly follow this exact approach.

## 1. Exporting Templates (Generating the Excel File)

- **Use `exceljs` instead of `xlsx` (SheetJS)**: Free versions of SheetJS do not support exporting data validation (dropdowns). You must use `exceljs` and `file-saver` to export the template.
- **Arabic Translation**: 
  - The downloaded file name MUST be in Arabic (e.g., `قالب_بيانات_المشتركين.xlsx`).
  - The worksheet name MUST be in Arabic (e.g., `workbook.addWorksheet('بيانات المشتركين', ...)`).
  - All column headers MUST be in Arabic (using an Arabic-to-English mapping).
- **RTL and Alignment**:
  - The worksheet MUST be set to RTL: `views: [{ rightToLeft: true }]`.
  - All columns MUST have centered alignment:
    ```typescript
    worksheet.columns.forEach(column => {
      column.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ```
- **AutoFilter**:
  - Always enable AutoFilter for the header row to allow easy searching and sorting:
    ```typescript
    worksheet.autoFilter = 'A1:Z1'; // Adjust range based on your columns
    ```
- **Data Validation (Dropdown Lists)**:
  - You MUST include data validation (dropdown lists) for any columns that map to strict database values (like Projects, Branches, Status, Roles, Gender).
  - **CRITICAL: DO NOT CREATE A SEPARATE 'Lists' SHEET.** The user requires everything to be in one single sheet to avoid confusing end users.
  - To bypass the 255-character formula limit for lists in Excel, you must write the list options into far, hidden columns on the **same sheet** (e.g., columns `Z`, `AA`, `AB`).
  - Example of hiding columns and setting data validation:
    ```typescript
    // Write options to far columns
    options.forEach((opt, idx) => {
      worksheet.getCell(`Z${idx + 1}`).value = opt.name_ar;
    });
    worksheet.getColumn('Z').hidden = true;

    // Apply data validation referencing the hidden column
    for (let i = 2; i <= 500; i++) {
      worksheet.getCell(`C${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`$Z$1:$Z$${Math.max(1, options.length)}`] // Same sheet reference
      };
    }
    ```

## 2. Importing & Processing (Reading the Excel File)

- **Use `xlsx` (SheetJS)**: Reading files can still be done using `XLSX.read()` as it is lightweight and fast for parsing.
- **Sheet Agnostic**: Always read the first sheet regardless of its Arabic name: `const ws = wb.Sheets[wb.SheetNames[0]];`
- **Reverse Mapping**: You MUST map the Arabic keys back to the English system keys before sending them to the backend or edge functions. Create an `ARABIC_COLUMNS_MAP` object for this mapping.
