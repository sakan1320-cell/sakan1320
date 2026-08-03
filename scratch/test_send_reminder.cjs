const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
// Load env manually
const envLines = fs.readFileSync('c:/Users/faarr/OneDrive/Documents/sakansa/.env','utf8').split('\n');
const env = {};
envLines.forEach(l=>{const m=l.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);if(m){let v=m[2]||'';if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(v.startsWith("'")&&v.endsWith("'"))v=v.slice(1,-1);env[m[1]]=v.trim();}});
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const phone = '+966545997897';
  const { data, error } = await supabase.functions.invoke('send-notification', {
    body: {
      template: 'reminder', // use a supported template instead of manual
      channel: 'whatsapp',
      recipient_phone: phone,
      body: 'اختبار إرسال يدويا',
    },
  });
  console.log('Response:', {data, error});
})();
