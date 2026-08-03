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

async function applyUpdatedRPC() {
  const supabase = createClient(URL, SERVICE_KEY);
  
  const sql = `
    CREATE OR REPLACE FUNCTION public.admin_change_user_password(target_user_id UUID, new_password TEXT)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth, extensions
    AS $$
    BEGIN
      -- 1. Check if caller is authenticated
      IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
      END IF;

      -- 2. Check if caller has the required permission (or is system_admin)
      IF NOT public.user_has_permission(auth.uid(), 'change_user_password') THEN
        RAISE EXCEPTION 'Permission denied';
      END IF;

      -- 3. Check password length
      IF length(new_password) < 6 THEN
        RAISE EXCEPTION 'Password must be at least 6 characters long';
      END IF;

      -- 4. Update password in auth.users table using explicit extensions prefix or search path
      UPDATE auth.users
      SET encrypted_password = crypt(new_password, gen_salt('bf')),
          updated_at = now()
      WHERE id = target_user_id;

      -- 5. Force is_password_setup_required to false on public.profiles
      UPDATE public.profiles
      SET is_password_setup_required = false,
          updated_at = now()
      WHERE id = target_user_id;

      RETURN TRUE;
    END;
    $$;
  `;
  
  console.log("Applying updated admin_change_user_password RPC with search_path including extensions...");
  const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
  
  if (error) {
    console.error("Failed to apply updated RPC:", error);
  } else {
    console.log("Updated RPC applied successfully!");
  }
}

applyUpdatedRPC();
