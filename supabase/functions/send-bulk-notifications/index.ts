import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface Recipient {
  phone: string;
  name?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Role check: only staff with notification-sending privileges may send bulk
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: allowed } = await admin.rpc("has_any_role", {
      _user_id: user.id,
      _roles: ["executive", "assistant", "project_manager", "branch_manager"],
    });
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { recipients, body, channel } = await req.json() as {
      recipients: Recipient[];
      body: string;
      channel?: "whatsapp" | "sms" | "email";
    };

    if (!Array.isArray(recipients) || recipients.length === 0 || !body?.trim()) {
      return new Response(JSON.stringify({ error: "recipients and body are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (recipients.length > 500) {
      return new Response(JSON.stringify({ error: "Max 500 recipients per batch" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0, failed = 0;
    const errors: string[] = [];

    for (const r of recipients) {
      if (!r.phone) { failed++; continue; }
      try {
        const { data, error } = await userClient.functions.invoke("send-notification", {
          body: {
            template: "manual",
            channel: channel ?? "whatsapp",
            recipient_phone: r.phone,
            recipient_name: r.name ?? null,
            body: body.trim(),
          },
        });
        if (error || data?.status !== "sent") {
          failed++;
          if (errors.length < 10) errors.push(`${r.phone}: ${error?.message ?? data?.error ?? "failed"}`);
        } else {
          sent++;
        }
      } catch (e) {
        failed++;
        if (errors.length < 10) errors.push(`${r.phone}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: recipients.length, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
