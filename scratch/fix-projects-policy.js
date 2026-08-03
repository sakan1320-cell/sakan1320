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

async function fixProjectsPolicy() {
  const supabase = createClient(URL, SERVICE_KEY);
  
  const sql = `
    DROP POLICY IF EXISTS "projects_select" ON public.projects;
    CREATE POLICY "projects_select" ON public.projects FOR SELECT
      USING (
        public.can_access_project(auth.uid(), id)
        OR EXISTS (
          SELECT 1 FROM public.participants p
          WHERE p.auth_user_id = auth.uid() 
            AND (p.project_id = projects.id OR EXISTS (
              SELECT 1 FROM public.participant_project_memberships m
              WHERE m.participant_id = p.id AND m.project_id = projects.id
            ))
        )
      );
  `;
  
  console.log("Updating projects select policy for participants...");
  const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
  
  if (error) {
    console.error("Failed to update projects policy:", error);
  } else {
    console.log("Projects select policy updated successfully!");
  }
}

fixProjectsPolicy();
