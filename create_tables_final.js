import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(envFile.split('\n').filter(Boolean).map(line => line.split('=')));

const url = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url.trim(), key.trim());

async function run() {
  const sql = \`n    CREATE TABLE IF NOT EXISTS public.companies (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS public.company_members (
      user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
      company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, company_id)
    );
    INSERT INTO public.companies (id, name) 
    VALUES ('00000000-0000-0000-0000-000000000001', 'الإدارة العامة') 
    ON CONFLICT (id) DO NOTHING;

    ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Enable read access for all users" ON public.companies FOR SELECT USING (true);
    CREATE POLICY "Enable all for admins" ON public.company_members FOR ALL USING (true);
    CREATE POLICY "Enable read for members" ON public.company_members FOR SELECT USING (true);
  \;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('Data:', data);
  if (error) console.error('Error:', error);
}

run();