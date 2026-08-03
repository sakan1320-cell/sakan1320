const fs = require('fs');
let content = fs.readFileSync('src/components/ParticipantFormDialog.tsx', 'utf8');

// 1. Update ParticipantRow interface
content = content.replace(
  '  email?: string | null;\n}',
  '  email?: string | null;\n  custom_fields?: Record<string, any> | null;\n}'
);

// 2. Import dynamic field type and z (though we might just do manual validation)
content = content.replace(
  'interface StaffUser { id: string; full_name: string | null; email: string | null; }',
  'interface StaffUser { id: string; full_name: string | null; email: string | null; }\ninterface DynamicField {\n  id: string;\n  name_ar: string;\n  field_type: string;\n  is_required: boolean;\n  min_length: number | null;\n  max_length: number | null;\n  regex_pattern: string | null;\n  options_array: string[] | null;\n  order_index: number;\n}'
);

// 3. Add state variables
content = content.replace(
  'const [saving, setSaving] = useState(false);',
  'const [saving, setSaving] = useState(false);\n  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);\n  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});'
);

// 4. Reset customFieldsData on open
content = content.replace(
  'setDeliveryChannel("whatsapp");\n    setUsernameHint(null);',
  'setDeliveryChannel("whatsapp");\n    setUsernameHint(null);\n    setCustomFieldsData(next.custom_fields || {});'
);

// 5. Fetch dynamic fields
content = content.replace(
  'supabase.from("profiles").select("id, full_name, email").order("full_name"),',
  'supabase.from("profiles").select("id, full_name, email").order("full_name"),\n        supabase.from("registration_form_fields").select("*").order("order_index"),'
);
content = content.replace(
  'const [pj, br, st] = await Promise.all',
  'const [pj, br, st, df] = await Promise.all'
);
content = content.replace(
  'setStaffUsers(st.data ?? []);',
  'setStaffUsers(st.data ?? []);\n      setDynamicFields((df.data ?? []) as DynamicField[]);'
);

// 6. Validation
const validationCode = `
    // Dynamic Validation
    let hasDynamicError = false;
    for (const field of dynamicFields) {
      const val = customFieldsData[field.id];
      if (field.is_required && (!val || (typeof val === 'string' && !val.trim()))) {
        toast.error(\`حقل \${field.name_ar} مطلوب\`);
        hasDynamicError = true;
        break;
      }
      if (val && typeof val === 'string') {
        if (field.min_length && val.length < field.min_length) {
          toast.error(\`حقل \${field.name_ar} يجب أن لا يقل عن \${field.min_length} حرف\`);
          hasDynamicError = true;
          break;
        }
        if (field.max_length && val.length > field.max_length) {
          toast.error(\`حقل \${field.name_ar} يجب أن لا يزيد عن \${field.max_length} حرف\`);
          hasDynamicError = true;
          break;
        }
        if (field.regex_pattern) {
          try {
            const regex = new RegExp(field.regex_pattern);
            if (!regex.test(val)) {
              toast.error(\`حقل \${field.name_ar} بصيغة غير صحيحة\`);
              hasDynamicError = true;
              break;
            }
          } catch (e) {
            console.error("Invalid regex in DB", e);
          }
        }
      }
    }
    if (hasDynamicError) return;
`;

content = content.replace(
  'setSaving(true);',
  validationCode + '\n    setSaving(true);'
);

// 7. Add custom_fields to payload
content = content.replace(
  'username: createAccount ? cleanUsername : form.username || null,',
  'username: createAccount ? cleanUsername : form.username || null,\n      custom_fields: customFieldsData,'
);

// 8. Render Dynamic Fields
const renderFieldsCode = `
            {dynamicFields.length > 0 && (
              <div className="rounded-md border p-3 space-y-3 bg-muted/10">
                <h3 className="font-medium text-sm border-b pb-2 mb-3">معلومات إضافية</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dynamicFields.map(f => (
                    <div key={f.id} className="space-y-1.5">
                      <Label>{f.name_ar} {f.is_required && <span className="text-destructive">*</span>}</Label>
                      {f.field_type === 'select' ? (
                        <Select value={customFieldsData[f.id] ?? ""} onValueChange={v => setCustomFieldsData(prev => ({...prev, [f.id]: v}))}>
                          <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                          <SelectContent>
                            {f.options_array?.map((opt, i) => <SelectItem key={i} value={opt}>{opt}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input 
                          type={f.field_type === 'date' ? 'date' : f.field_type === 'number' ? 'number' : 'text'}
                          value={customFieldsData[f.id] ?? ""} 
                          onChange={e => setCustomFieldsData(prev => ({...prev, [f.id]: e.target.value}))} 
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
`;

content = content.replace(
  '<div>\n              <Label>{t("participants.notes")}</Label>',
  renderFieldsCode + '\n            <div>\n              <Label>{t("participants.notes")}</Label>'
);

fs.writeFileSync('src/components/ParticipantFormDialog.tsx', content, 'utf8');
console.log('OK');
