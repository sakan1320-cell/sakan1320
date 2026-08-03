import { WhatsAppSettings } from "@/hooks/useWhatsAppSettings";

const TEMPLATE_PARAM_NAMES: Record<string, string[]> = {
  sakan_test_5: ["user_name"],
  sakan_test_4: ["user_name", "test_id"]
};

export async function sendWhatsAppTemplateMessage(
  phone: string, 
  templateName: string, 
  settings: WhatsAppSettings,
  mapping?: Array<{ schemaPropertyName: string; schemaPropertyValue: string }>
) {
  const { pluginId, phoneNumberId, accessToken } = settings;

  if (!pluginId || !phoneNumberId || !accessToken) {
    throw new Error('بيانات الربط غير مكتملة (Plugin ID, Phone Number ID, Access Token)');
  }

  const cleanPhone = phone.trim().replace(/^\+/, "").replace(/\D/g, "");

  // ChakraHQ send-template-message endpoint
  const url = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${pluginId}/phoneNumber/${cleanPhone}/send-template-message`;

  const payload: any = {
    whatsappPhoneNumberId: phoneNumberId,
    templateName: templateName
  };

  let finalMapping = mapping;
  if (mapping && mapping.length > 0) {
    const knownParams = TEMPLATE_PARAM_NAMES[templateName];
    if (knownParams) {
      finalMapping = mapping.map((m, idx) => {
        if (/^\d+$/.test(m.schemaPropertyName) && knownParams[idx]) {
          return {
            schemaPropertyName: knownParams[idx],
            schemaPropertyValue: m.schemaPropertyValue
          };
        }
        return m;
      });
    }
    
    payload.mapping = finalMapping;
    const values = finalMapping.map(x => x.schemaPropertyValue);
    const objFormat = values.map(v => ({ default: v }));
    
    // Standard and fallback formats
    payload.localizable_params = objFormat;
    payload.localizableParams = objFormat;
    payload.bodyParams = values;
    payload.body_params = values;
    payload.params = values;
    payload.parameters = values;
    payload.templateParams = values;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("WhatsApp API Error:", data);
    const apiError = data.error?.message || data.message || JSON.stringify(data);
    throw new Error(`فشل إرسال الرسالة: ${apiError}`);
  }

  return data;
}
