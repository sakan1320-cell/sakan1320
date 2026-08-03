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

async function testSelect() {
  const admin = createClient(URL, SERVICE_KEY);
  const userId = "2ef66817-5754-42c2-8651-cb8a4deab421"; // The participant's user ID

  // 1. Reset password of the participant user so we can log in
  console.log("Resetting participant password...");
  await admin.auth.admin.updateUserById(userId, {
    password: "password123"
  });

  // 2. Create client and log in as the participant
  const userClient = createClient(URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  console.log("Logging in as participant...");
  const { data: authData, error: authError } = await userClient.auth.signInWithPassword({
    email: "2222222222@participant.local",
    password: "password123"
  });

  if (authError) {
    console.error("Login failed:", authError);
    return;
  }
  console.log("Logged in successfully. User ID:", authData.user.id);

  // 3. Query profiles
  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  console.log("Profile result:", profile, "Error:", profileError);

  // 4. Query participants
  const { data: parts, error: partsError } = await userClient
    .from("participants")
    .select("*")
    .eq("auth_user_id", userId);
  console.log("Participants query result:", parts, "Error:", partsError);

  if (parts && parts.length > 0) {
    const partId = parts[0].id;
    // 5. Query memberships
    const { data: members, error: membersError } = await userClient
      .from("participant_project_memberships")
      .select("*")
      .eq("participant_id", partId);
    console.log("Memberships query result:", members, "Error:", membersError);

    // 6. Query projects
    const projectIds = Array.from(new Set([...(members || []).map((m) => m.project_id), parts[0].project_id].filter(Boolean)));
    console.log("Project IDs to fetch:", projectIds);
    if (projectIds.length > 0) {
      const { data: projs, error: projsError } = await userClient
        .from("projects")
        .select("id,name_ar,name_en,start_date,end_date")
        .in("id", projectIds);
      console.log("Projects query result:", projs, "Error:", projsError);
    }
  }
}

testSelect();
