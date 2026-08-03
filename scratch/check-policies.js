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
    SELECT schemaname, tablename, policyname, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'projects';
  `;
  
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });
  if (error) {
    console.error("Error fetching policies:", error);
  } else {
    console.log("Policies:", data);
  }
}

checkPolicies();
