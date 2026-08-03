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

async function resetPassword() {
  const admin = createClient(URL, SERVICE_KEY);
  const userId = "2ef66817-5754-42c2-8651-cb8a4deab421"; // The participant's user ID

  console.log("Resetting participant password back to '2222222222'...");
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    password: "2222222222"
  });

  if (error) {
    console.error("Failed to reset password:", error);
  } else {
    console.log("Password reset successfully back to '2222222222'!");
  }
}

resetPassword();
