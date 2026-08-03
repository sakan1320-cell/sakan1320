// Send absence notifications to guardians via Meta WhatsApp Cloud API.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";

function normalizePhone(num: string): string {
  return num.trim().replace(/^whatsapp:/i, "").replace(/^\+/, "").replace(/\D/g, "");
}

type MetaTemplate = {
  name: string;
  language: { code: string };
  components?: any[];
};

async function sendViaProvider(to: string, body: string, templatePayload?: MetaTemplate): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID");
  const pluginId = Deno.env.get("META_WHATSAPP_PLUGIN_ID");

  if (!accessToken || !phoneNumberId) {
    return { ok: false, error: "Meta WhatsApp not configured" };
  }

  try {
    const url = pluginId 
      ? `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${pluginId}/api/${META_GRAPH_VERSION}/${phoneNumberId}/messages`
      : `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
    };

    if (templatePayload) {
      payload.type = "template";
      payload.template = templatePayload;
    } else {
      payload.type = "text";
      payload.text = { preview_url: false, body };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error?.message ?? data?.message ?? JSON.stringify(data);
      return { ok: false, error: `Meta WhatsApp [${res.status}]: ${errMsg}` };
    }
    const messageId = data?.messages?.[0]?.id || data?._data?.whatsappMessageId;
    return { ok: true, messageId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: ce } = await userClient.auth.getUser();
    if (ce || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const { project_id, branch_id, date } = await req.json() as { project_id: string; branch_id?: string | null; date: string };
    if (!project_id || !date) {
      return new Response(JSON.stringify({ error: "project_id and date are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Role check + project access check
    const { data: rolesData, error: rolesError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) {
      console.error("Error checking user roles:", rolesError);
      return new Response(JSON.stringify({ error: "Internal server error checking roles" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userRoles = rolesData?.map(r => r.role) || [];
    const allowedRoles = ["system_admin", "executive", "assistant", "project_manager", "branch_manager", "board"];
    const allowed = userRoles.some(r => allowedRoles.includes(r));

    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: canAccess } = await admin.rpc("can_access_project", {
      _user_id: userId,
      _project_id: project_id,
    });
    if (!canAccess) {
      return new Response(JSON.stringify({ error: "Forbidden: no access to project" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let aq = admin.from("attendance")
      .select("subject_id")
      .eq("project_id", project_id)
      .eq("date", date)
      .eq("status", "absent")
      .eq("subject_type", "participant");
    if (branch_id) aq = aq.eq("branch_id", branch_id);
    const { data: absent } = await aq;
    const absentIds = (absent ?? []).map((a) => a.subject_id);
    if (absentIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: parts } = await admin
      .from("participants")
      .select("id, full_name, guardian_name, guardian_phone")
      .in("id", absentIds);

    const eligible = (parts ?? []).filter((p) => p.guardian_phone);
    if (eligible.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: 0, failed: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: project } = await admin.from("projects").select("name_ar").eq("id", project_id).single();
    const projectName = project?.name_ar ?? "";

    const { data: optOutsData } = await admin.from("whatsapp_opt_outs").select("phone_number");
    const optOutsSet = new Set((optOutsData ?? []).map(o => o.phone_number));

    const { data: existingNotifs } = await admin
      .from("notifications")
      .select("related_entity_id, status")
      .eq("template", "absence")
      .eq("related_entity_type", "participant")
      .in("related_entity_id", absentIds)
      .gte("created_at", `${date}T00:00:00Z`)
      .lt("created_at", `${date}T23:59:59Z`);
    const alreadySent = new Set(
      (existingNotifs ?? [])
        .filter((n) => ["sent", "delivered", "read", "pending"].includes(n.status as string))
        .map((n) => n.related_entity_id as string),
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const p of eligible) {
      if (alreadySent.has(p.id)) { skipped++; continue; }
      const guardianName = p.guardian_name || "ولي الأمر";
      const phone = p.guardian_phone as string;
      const body = `عزيزي ${guardianName}، نفيدكم بغياب ${p.full_name} اليوم ${date}${projectName ? ` في ${projectName}` : ""}. شكرًا لكم.`;

      const { data: inserted } = await admin.from("notifications").insert({
        channel: "whatsapp",
        recipient_phone: phone,
        recipient_name: guardianName,
        body,
        template: "absence",
        related_entity_type: "participant",
        related_entity_id: p.id,
        status: "pending",
        created_by: userId,
      }).select().single();

      const metaTemplate: MetaTemplate = {
        name: "absence_alert",
        language: { code: "ar" },
        components: [
          {
            type: "body",
            parameters: [
              { name: "guardian_name", type: "text", text: guardianName },
              { name: "participant_name", type: "text", text: p.full_name || "الطالب" },
              { name: "date", type: "text", text: date },
              { name: "project_name", type: "text", text: projectName || "سكن" },
            ]
          }
        ]
      };

      let result: { ok: boolean, messageId?: string, error?: string };
      if (optOutsSet.has(normalizePhone(phone))) {
        result = { ok: false, error: "User opted out of WhatsApp messages" };
      } else {
        result = await sendViaProvider(phone, body, metaTemplate);
      }

      if (inserted) {
        await admin.from("notifications").update({
          status: result.ok ? "sent" : "failed",
          provider_message_id: result.messageId ?? null,
          error: result.error ?? null,
          sent_at: result.ok ? new Date().toISOString() : null,
        }).eq("id", inserted.id);
      }
      if (result.ok) sent++; else failed++;
    }

    await admin.from("audit_log").insert({
      user_id: userId,
      action: "send_absence_notifications",
      entity_type: "project",
      entity_id: project_id,
      metadata: { date, sent, skipped, failed, branch_id: branch_id ?? null },
    });

    return new Response(JSON.stringify({ sent, skipped, failed }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-absence-notifications error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
