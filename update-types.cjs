const fs = require('fs');
let content = fs.readFileSync('src/integrations/supabase/types.ts', 'utf16le');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
// Replace participants Row
content = content.replace(
  '          updated_at: string\n        }\n        Insert: {',
  '          updated_at: string\n          custom_fields?: Json | null\n        }\n        Insert: {'
);
content = content.replace(
  '          updated_at?: string\n        }\n        Update: {',
  '          updated_at?: string\n          custom_fields?: Json | null\n        }\n        Update: {'
);
content = content.replace(
  '          updated_at?: string\n        }\n        Relationships: []',
  '          updated_at?: string\n          custom_fields?: Json | null\n        }\n        Relationships: []'
);

// Add registration_form_fields
const newTable = `      registration_form_fields: {
        Row: {
          id: string
          name_ar: string
          field_type: string
          is_required: boolean | null
          min_length: number | null
          max_length: number | null
          regex_pattern: string | null
          options_array: Json | null
          order_index: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name_ar: string
          field_type: string
          is_required?: boolean | null
          min_length?: number | null
          max_length?: number | null
          regex_pattern?: string | null
          options_array?: Json | null
          order_index?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name_ar?: string
          field_type?: string
          is_required?: boolean | null
          min_length?: number | null
          max_length?: number | null
          regex_pattern?: string | null
          options_array?: Json | null
          order_index?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }\n`;

content = content.replace('    Tables: {\n', '    Tables: {\n' + newTable);

fs.writeFileSync('src/integrations/supabase/types.ts', content, 'utf8');
