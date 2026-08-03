// Admin operations: create user / update profile / change password / delete user.
// Callable by users with role 'executive' OR 'system_admin'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "create" | "update_profile" | "change_password" | "delete";

interface Payload {
  action: Action;
  user_id?: string;
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the calling user via their JWT
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = caller.id;

    // Allow executive OR system_admin to perform admin operations
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["executive", "system_admin"]);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden: executive or system_admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as Payload;

    if (payload.action === "create") {
      if (!payload.email || !payload.password) {
        return new Response(JSON.stringify({ error: "email and password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (payload.password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: {
          full_name: payload.full_name ?? "",
          phone: payload.phone ?? "",
        },
      });
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message ?? "Create failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const newId = created.user.id;

      // Ensure profile row exists
      await admin.from("profiles").upsert({
        id: newId,
        full_name: payload.full_name ?? "",
        email: payload.email,
        phone: payload.phone ?? "",
      }, { onConflict: "id" });

      // Assign requested role (remove default employee role if different)
      if (payload.role && payload.role !== "employee") {
        await admin.from("user_roles").delete().eq("user_id", newId).eq("role", "employee");
      }
      if (payload.role) {
        await admin.from("user_roles").upsert(
          { user_id: newId, role: payload.role },
          { onConflict: "user_id,role" }
        );
      }

      await admin.from("audit_log").insert({
        user_id: callerId,
        action: "admin_create_user",
        entity_type: "user",
        entity_id: newId,
        metadata: { email: payload.email, role: payload.role ?? "employee" },
      });

      return new Response(JSON.stringify({ id: newId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.action === "update_profile") {
      if (!payload.user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const profileUpdates: Record<string, unknown> = {};
      if (payload.full_name !== undefined) profileUpdates.full_name = payload.full_name;
      if (payload.phone !== undefined) profileUpdates.phone = payload.phone;
      if (payload.email !== undefined) profileUpdates.email = payload.email;

      if (Object.keys(profileUpdates).length > 0) {
        await admin.from("profiles").update(profileUpdates).eq("id", payload.user_id);
      }
      if (payload.email) {
        await admin.auth.admin.updateUserById(payload.user_id, { email: payload.email });
      }

      await admin.from("audit_log").insert({
        user_id: callerId,
        action: "admin_update_user",
        entity_type: "user",
        entity_id: payload.user_id,
        metadata: profileUpdates,
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.action === "change_password") {
      if (!payload.user_id || !payload.password) {
        return new Response(JSON.stringify({ error: "user_id and password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (payload.password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin.auth.admin.updateUserById(payload.user_id, { password: payload.password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("audit_log").insert({
        user_id: callerId,
        action: "admin_change_password",
        entity_type: "user",
        entity_id: payload.user_id,
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.action === "delete") {
      if (!payload.user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (payload.user_id === callerId) {
        return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin.auth.admin.deleteUser(payload.user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("audit_log").insert({
        user_id: callerId,
        action: "admin_delete_user",
        entity_type: "user",
        entity_id: payload.user_id,
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-create-user error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
