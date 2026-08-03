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
    ADD COLUMN IF NOT EXISTS enjaz_points_present integer DEFAULT 5,
    ADD COLUMN IF NOT EXISTS enjaz_points_late integer DEFAULT 2,
    ADD COLUMN IF NOT EXISTS enjaz_points_absent integer DEFAULT -5,
    ADD COLUMN IF NOT EXISTS enjaz_points_excused integer DEFAULT 0;
  `;
  
  console.log("Adding default attendance points configuration columns to public.projects...");
  const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
  
  if (error) {
    console.error("Migration failed:", error);
  } else {
    console.log("Migration applied successfully!");
  }
}

runMigration();
