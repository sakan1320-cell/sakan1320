module.paths.push('c:/Users/faarr/OneDrive/Documents/sakansa/node_modules');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('c:/Users/faarr/OneDrive/Documents/sakansa/.env', 'utf8');
const lines = envContent.split('\n');
const env = {};
lines.forEach(l => {
  const m = l.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let value = m[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[m[1]] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      ALTER TABLE public.enjaz_groups 
      ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.project_branches(id) ON DELETE SET NULL;
    `
  });
  console.log('Add branch_id column result:', { data, error });
}

run();
