const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function resetUsers() {
  if (!URL || !SERVICE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log("Updating existing admin account...");

  const NEW_EMAIL = "sakan1320@gmail.com";
  const NEW_USERNAME = "sakan1320@gmail.com"; // User requested username to be sakan1320@gmail.com
  const NEW_PASSWORD = "sakan1320@gmail.com";
  const USER_ID = "4622f56c-e003-499f-9e53-230a07afa525";

  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(USER_ID, {
    password: NEW_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "مدير النظام", username: NEW_USERNAME },
  });

  if (updateError) {
    console.error("Error updating admin:", updateError);
    return;
  }

  const user = updated.user;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    username: NEW_USERNAME,
    normalized_username: NEW_USERNAME.toLowerCase(),
    full_name: "مدير النظام",
  });
  
  if (profileError) console.error("Profile Error:", profileError);

  const { error: roleError } = await admin.from("user_roles").upsert({ user_id: user.id, role: "system_admin" }, { onConflict: "user_id, role" });
  if (roleError) console.error("Role Error:", roleError);

  console.log("Done.");
  console.log("  Email:", NEW_EMAIL);
  console.log("  Username:", NEW_USERNAME);
  console.log("  Password:", NEW_PASSWORD);
}

resetUsers();
