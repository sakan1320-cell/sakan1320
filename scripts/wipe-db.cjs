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

async function wipeDatabase() {
  if (!URL || !SERVICE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const tables = [
    'lms_activity_submissions', 'lms_activities', 'lms_instructor_notes', 'lms_learning_paths',
    'lms_quiz_attempts', 'lms_certificates', 'lms_enrollments', 'lms_questions', 'lms_quizzes',
    'lms_lessons', 'lms_modules', 'lms_courses',
    'support_tickets', 'messages', 'message_thread_members', 'message_threads',
    'profile_edit_requests', 'participant_project_memberships', 'participants',
    'tasks', 'project_branches', 'projects', 'system_attachments', 'system_comments',
    'system_timeline_events', 'finance_transactions', 'notifications',
    'user_roles', 'profiles'
  ];

  for (const table of tables) {
    console.log(`Deleting from ${table}...`);
    const { error } = await admin.from(table).delete().not('id', 'is', null);
    if (error) {
      console.error(`Error deleting from ${table}:`, error.message);
    }
  }

  console.log("Now deleting all users from auth.users...");
  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  
  if (usersError) {
    console.error("Failed to list users:", usersError);
  } else {
    for (const user of usersData.users) {
      const { error: delError } = await admin.auth.admin.deleteUser(user.id);
      if (delError) {
        console.error(`Failed to delete user ${user.id}:`, delError);
      } else {
        console.log(`Deleted user ${user.id} (${user.email})`);
      }
    }
  }

  console.log("Creating the new admin account (sakan1320@gmail.com)...");

  const NEW_EMAIL = "sakan1320@gmail.com";
  const NEW_USERNAME = "sakan1320@gmail.com";
  const NEW_PASSWORD = "sakan1320@gmail.com";

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: NEW_EMAIL,
    password: NEW_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "مدير النظام", username: NEW_USERNAME },
  });

  if (createError) {
    console.error("Error creating new admin:", createError);
    return;
  }

  const user = created.user;

  console.log("Re-creating profile and roles for the new admin...");

  await admin.from("profiles").upsert({
    id: user.id,
    username: NEW_USERNAME,
    normalized_username: NEW_USERNAME.toLowerCase(),
    full_name: "مدير النظام",
  });

  await admin.from("user_roles").upsert({ user_id: user.id, role: "system_admin" }, { onConflict: "user_id, role" });

  console.log("Done.");
  console.log("  Email:", NEW_EMAIL);
  console.log("  Username:", NEW_USERNAME);
  console.log("  Password:", NEW_PASSWORD);
}

wipeDatabase();
