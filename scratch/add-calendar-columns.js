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

async function runMigration() {
  const supabase = createClient(URL, SERVICE_KEY);
  
  const sql = `
    ALTER TABLE public.projects 
    ADD COLUMN IF NOT EXISTS excluded_weekdays integer[] DEFAULT '{}'::integer[],
    ADD COLUMN IF NOT EXISTS excluded_dates date[] DEFAULT '{}'::date[];
  `;
  
  console.log("Adding excluded_weekdays and excluded_dates columns to projects table...");
  const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
  
  if (error) {
    console.error("Failed to add columns:", error);
  } else {
    console.log("Columns added successfully!");
  }
}

runMigration();
