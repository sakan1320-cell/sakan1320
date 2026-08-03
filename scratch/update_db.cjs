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
  console.log('Applying Database updates...');
  const sql = `
    -- 1. Add email column to participants
    ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS email TEXT;
    
    -- 2. Ensure project_id is nullable (fix constraint)
    ALTER TABLE public.participants ALTER COLUMN project_id DROP NOT NULL;
    
    -- 3. Create system_errors table
    CREATE TABLE IF NOT EXISTS public.system_errors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      error_type TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      user_id UUID REFERENCES auth.users(id),
      severity TEXT DEFAULT 'error',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- 4. Enable RLS
    ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;
    
    -- 5. Policies
    DROP POLICY IF EXISTS "system_errors_select" ON public.system_errors;
    CREATE POLICY "system_errors_select" ON public.system_errors 
      FOR SELECT TO authenticated 
      USING (
        public.is_system_admin(auth.uid()) 
        OR public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[])
      );
      
    DROP POLICY IF EXISTS "system_errors_insert" ON public.system_errors;
    CREATE POLICY "system_errors_insert" ON public.system_errors 
      FOR INSERT WITH CHECK (true);
      
    -- 6. Grants
    GRANT ALL ON public.system_errors TO postgres, service_role;
    GRANT SELECT, INSERT ON public.system_errors TO authenticated;
    GRANT INSERT ON public.system_errors TO anon;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error executing SQL migration:', error);
  } else {
    console.log('Database updates applied successfully!');
  }
}

run();
