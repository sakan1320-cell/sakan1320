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

async function fixPolicy() {
  const supabase = createClient(URL, SERVICE_KEY);
  
  const sql = `
    DROP POLICY IF EXISTS participants_select ON public.participants;
    CREATE POLICY participants_select ON public.participants 
      FOR SELECT 
      USING (public.can_access_project(auth.uid(), project_id) OR auth.uid() = auth_user_id);
  `;
  
  console.log("Updating participants RLS policy to allow participants to select their own record...");
  const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
  
  if (error) {
    console.error("Failed to update policy:", error);
  } else {
    console.log("Policy updated successfully!");
  }
}

fixPolicy();
