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

async function check() {
  const supabase = createClient(URL, SERVICE_KEY);
  
  // 1. List auth users
  const { data: { users } } = await supabase.auth.admin.listUsers();
  console.log("--- Auth Users ---");
  users.forEach(u => console.log(`ID: ${u.id}, Email: ${u.email}`));

  // 2. List participants
  const { data: parts } = await supabase.from("participants").select("id, full_name, auth_user_id, project_id");
  console.log("--- Participants ---");
  console.log(parts);
}

check();
