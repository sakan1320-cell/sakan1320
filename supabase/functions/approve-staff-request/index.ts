import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Permission check: system_admin or executive or assistant
    const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", caller.id);
    const roles = (callerRoles ?? []).map(r => r.role);
    const isAuthorized = roles.some(r => ["system_admin", "executive", "assistant"].includes(r));
    
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Forbidden: Insufficient permissions" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { request_id } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: "request_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: reqRow, error: reqErr } = await admin
      .from("staff_registration_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (reqErr || !reqRow) {
      return new Response(JSON.stringify({ error: "Request not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    if (reqRow.status !== "pending") {
      return new Response(JSON.stringify({ error: "Already processed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate temp password
    const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 14) + "Aa1!";

    // Create user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: reqRow.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: reqRow.full_name,
        phone: reqRow.phone,
      },
    });

    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Could not create user" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = created.user.id;

    // Trigger handle_new_user creates profile, but we set setup required
    await admin.from("profiles").update({
      is_password_setup_required: true,
      full_name: reqRow.full_name,
      phone: reqRow.phone
    } as any).eq("id", userId);

    // Assign roles
    // Default profile trigger might have added 'employee', replace if requested role is different
    const targetRole = reqRow.requested_role || "employee";
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert([{ user_id: userId, role: targetRole }]);

    // Update request status
    await admin
      .from("staff_registration_requests")
      .update({
        status: "approved",
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request_id);

    // Log action
    await admin.from("audit_log").insert({
      user_id: caller.id,
      action: "approve_staff_request",
      entity_type: "staff_registration_requests",
      entity_id: request_id,
      metadata: { email: reqRow.email, role: targetRole },
    });

    return new Response(
      JSON.stringify({ success: true, user_id: userId, temp_password: tempPassword }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("approve-staff-request error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
