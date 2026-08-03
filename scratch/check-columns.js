import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkColumns() {
  const supabase = createClient(URL, SERVICE_KEY);
  
  const createFunc = `
    CREATE OR REPLACE FUNCTION public.get_table_columns()
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      result JSONB;
    BEGIN
      SELECT jsonb_agg(column_name) INTO result
      FROM information_schema.columns 
      WHERE table_name = 'enjaz_groups';
      RETURN result;
    END;
    $$;
  `;
  
  await supabase.rpc("exec_sql", { sql_query: createFunc });
  
  const { data, error } = await supabase.rpc("get_table_columns");
  console.log("Columns of enjaz_groups:", data, "Error:", error);
  
  await supabase.rpc("exec_sql", { sql_query: "DROP FUNCTION IF EXISTS public.get_table_columns();" });
}

checkColumns();
