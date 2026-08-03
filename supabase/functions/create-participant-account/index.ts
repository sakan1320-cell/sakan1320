// Creates an Auth user for a participant. Username/password default to national_id.
// Email is synthetic because participant email is intentionally optional.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  participant_id: string;
  national_id: string;
  username?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  send_credentials?: boolean;
  delivery_channel?: "none" | "whatsapp" | "sms" | "notification";
}

const USERNAME_RE = /^[A-Za-z0-9]+$/;

const credentialMessage = (username: string, password: string) =>
  `بيانات دخولك في منصة سكن المجتمع:\nاسم المستخدم: ${username}\nكلمة المرور المؤقتة: ${password}\nيرجى تغيير كلمة المرور عند أول دخول.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check permissions: executive, assistant, project_manager, branch_manager, system_admin
    const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", caller.id);
    const roles = (callerRoles ?? []).map(r => r.role);
    const isAuthorized = roles.some(r => ["system_admin", "executive", "assistant", "project_manager", "branch_manager"].includes(r));
    
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Forbidden: Insufficient permissions" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = (await req.json()) as Payload;
    if (!payload.participant_id || !payload.national_id) {
      return new Response(JSON.stringify({ error: "participant_id and national_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const nid = payload.national_id.trim();
    if (nid.length < 6) {
      return new Response(JSON.stringify({ error: "national_id too short (min 6)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const username = (payload.username || nid).trim();
    const password = (payload.password || nid).trim();
    if (!USERNAME_RE.test(username)) {
      return new Response(JSON.stringify({ error: "Username must contain English letters and numbers only." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const normalizedUsername = username.toLowerCase();
    const { data: profileTaken } = await admin
      .from("profiles")
      .select("id")
      .eq("normalized_username", normalizedUsername)
      .maybeSingle();
    const { data: participantTaken } = await admin
      .from("participants")
      .select("id")
      .eq("username", username)
      .neq("id", payload.participant_id)
      .maybeSingle();
    if (profileTaken || participantTaken) {
      const suggestion = `${username}${Math.floor(100 + Math.random() * 900)}`;
      return new Response(JSON.stringify({ error: "Username already exists.", suggestion }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let email = (payload.email || "").trim().toLowerCase();
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(JSON.stringify({ error: "صيغة البريد الإلكتروني غير صحيحة." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: emailTaken } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (emailTaken) {
        return new Response(JSON.stringify({ error: "البريد الإلكتروني مستخدم مسبقًا لحساب آخر." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      email = `${normalizedUsername}@participant.local`;
    }

    const userMetadata = {
      full_name: payload.full_name ?? "",
      phone: payload.phone ?? "",
      participant_id: payload.participant_id,
      username,
      national_id: nid,
    };

    // Try create user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    let userId: string | null = created?.user?.id ?? null;
    
    if (createErr) {
      const msg = createErr.message || "";
      if (msg.includes("already") || msg.includes("registered")) {
        // Find existing user by email to avoid listUsers()
        const { data: found } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
        if (found) {
          userId = found.id;
          // Update password for existing user
          const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { password });
          if (updateErr) throw updateErr;
        } else {
          return new Response(JSON.stringify({ error: `User with email ${email} already exists but profile not found.` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        throw createErr;
      }
    }

    if (!userId) {
      throw new Error("Failed to resolve user ID");
    }

    const { error: metadataErr } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: userMetadata,
    });
    if (metadataErr) throw metadataErr;

    // Force profile setup requirements. Use upsert because the auth trigger may
    // not have created the profile row yet in every environment.
    const profilePayload = {
      id: userId,
      username,
      normalized_username: normalizedUsername,
      national_id: nid,
      is_password_setup_required: true,
      email,
      phone: payload.phone ?? null,
      full_name: payload.full_name ?? "",
    };
    const { error: profileErr } = await admin.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (profileErr) {
      // Keep account creation working on older schemas while migrations catch up.
      const { error: fallbackProfileErr } = await admin.from("profiles").upsert({
        id: userId,
        username,
        normalized_username: normalizedUsername,
        national_id: nid,
        full_name: payload.full_name ?? "",
      }, { onConflict: "id" });
      if (fallbackProfileErr) throw profileErr;
    }

    // Ensure participant role
    const { error: deleteRolesErr } = await admin.from("user_roles").delete().eq("user_id", userId);
    if (deleteRolesErr) throw deleteRolesErr;
    const { error: roleErr } = await admin.from("user_roles").insert([{ user_id: userId, role: "participant" }]);
    if (roleErr) throw roleErr;

    // Link to participant record
    const { error: participantLinkErr } = await admin.from("participants")
      .update({
        auth_user_id: userId,
        username,
      })
      .eq("id", payload.participant_id)
      .select("id")
      .single();
    if (participantLinkErr) throw participantLinkErr;

    if (payload.send_credentials && payload.delivery_channel && payload.delivery_channel !== "none") {
      const body = credentialMessage(username, password);
      if (payload.delivery_channel === "notification") {
        await admin.from("in_app_notifications").insert({
          user_id: userId,
          title: "بيانات الدخول",
          body,
          type: "info",
          priority: "high",
          entity_type: "participant",
          entity_id: payload.participant_id,
          action_url: "/portal",
        });
      } else {
        await admin.from("notifications").insert({
          channel: payload.delivery_channel,
          recipient_phone: payload.phone ?? null,
          recipient_name: payload.full_name ?? null,
          body,
          template: "manual",
          related_entity_type: "participant",
          related_entity_id: payload.participant_id,
          status: "pending",
          created_by: caller.id,
          target_user_id: userId,
        });
      }
    }

    // Log the action
    await admin.from("audit_log").insert({
      user_id: caller.id,
      action: "create_participant_account",
      entity_type: "participant",
      entity_id: payload.participant_id,
      metadata: { email, national_id: nid, username },
    });

    return new Response(JSON.stringify({ ok: true, user_id: userId, username }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("create-participant-account error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
