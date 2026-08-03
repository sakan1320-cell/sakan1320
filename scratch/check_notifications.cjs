const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('c:/Users/faarr/OneDrive/Documents/sakansa/.env','utf8').split('\n').forEach(l=>{
  const m=l.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if(m){ let v=m[2]||''; if(v.startsWith('"')&&v.endsWith('"')) v=v.slice(1,-1); if(v.startsWith("'")&&v.endsWith("'")) v=v.slice(1,-1); env[m[1]]=v.trim(); }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const { data, error } = await supabase.from('notifications').select('*').eq('recipient_phone', '+966545997897').order('created_at', { ascending: false }).limit(10);
  if(error){ console.error('Error:', error); process.exit(1); }
  console.log('Rows:', JSON.stringify(data, null, 2));
})();
