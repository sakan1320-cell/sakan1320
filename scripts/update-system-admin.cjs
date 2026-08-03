/**
 * Updates system admin via Supabase Admin API.
 * Usage: set SUPABASE_SERVICE_ROLE_KEY in .env then: node scripts/update-system-admin.cjs
 */
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
const NEW_EMAIL = "sakan1320@gmail.com";
const NEW_USERNAME = "sakan1320";
const NEW_PASSWORD = "sakan1320@gmail.com";
const OLD_EMAILS = ["admin@sakansa.com", "sakan1320@gmail.com"];

async function main() {
  if (!URL || !SERVICE_KEY) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  let user = null;
  for (const oldEmail of OLD_EMAILS) {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    user = data?.users?.find((u) => u.email === oldEmail) ?? null;
    if (user) break;
  }
  if (!user) {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    user = data?.users?.find((u) => u.email?.includes("admin") || u.user_metadata?.username === "admin") ?? null;
  }

  if (!user) {
    console.log("Creating new system admin user...");
    const { data: created, error } = await admin.auth.admin.createUser({
      email: NEW_EMAIL,
      password: NEW_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "مدير النظام", username: NEW_USERNAME },
    });
    if (error) throw error;
    user = created.user;
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email: NEW_EMAIL,
      password: NEW_PASSWORD,
      email_confirm: true,
      user_metadata: { ...user.user_metadata, full_name: user.user_metadata?.full_name || "مدير النظام", username: NEW_USERNAME },
    });
    if (error) throw error;
  }

  await admin.from("profiles").update({
    email: NEW_EMAIL,
    username: NEW_USERNAME,
    normalized_username: NEW_USERNAME.toLowerCase(),
    full_name: "مدير النظام",
  }).eq("id", user.id);

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r) => r.role === "system_admin")) {
    await admin.from("user_roles").insert({ user_id: user.id, role: "system_admin" });
  }

  console.log("Done.");
  console.log("  Email:", NEW_EMAIL);
  console.log("  Username:", NEW_USERNAME);
  console.log("  Password:", NEW_PASSWORD);
  console.log("  User ID:", user.id);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});