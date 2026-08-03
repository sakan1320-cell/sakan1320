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

async function checkPolicies() {
  const supabase = createClient(URL, SERVICE_KEY);
  
  const sql = `
    DO $$
    DECLARE
      result TEXT;
    BEGIN
      SELECT jsonb_agg(jsonb_build_object(
        'column_name', column_name,
        'data_type', data_type
      ))::text INTO result
      FROM information_schema.columns 
      WHERE table_name = 'projects';
      RAISE EXCEPTION 'COLUMNS_RESULT: %', result;
    END;
    $$;
  `;
  
  const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
  console.log("Error object:", error);
}

checkPolicies();
