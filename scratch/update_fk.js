const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);
const url = urlMatch[1];
const key = keyMatch[1];

async function run() {
  const headers = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };
  
  const sql = `
    ALTER TABLE public.project_members DROP CONSTRAINT IF EXISTS project_members_group_id_fkey;
    ALTER TABLE public.project_members ADD CONSTRAINT project_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.enjaz_groups(id) ON DELETE CASCADE;
  `;
  
  const res = await fetch(url + '/rest/v1/rpc/exec_sql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql })
  });
  
  console.log(res.status, await res.text());
}
run().catch(console.error);
