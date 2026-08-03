const fs = require('fs');
const path = require('path');

// Load .env manually (simple parser)
const envPath = path.resolve(__dirname, '..', '.env');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let [, key, val] = match;
    if (val) {
      val = val.trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
    }
    env[key] = val;
  }
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-notification`;

(async () => {
  const payload = {
    template: 'reminder', // choose a supported template
    channel: 'whatsapp',
    recipient_phone: '+966545997897',
    body: 'اختبار إرسال يدوي للرقم الفاشل',
  };

  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch (e) {
    console.error('Error:', e);
  }
})();
