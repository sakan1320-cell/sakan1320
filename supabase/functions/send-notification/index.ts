import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Channel = "whatsapp" | "sms" | "email";

interface Payload {
  template: string; // The key of the template in notification_templates
  channel?: Channel;
  recipient_phone?: string;
  recipient_email?: string;
  recipient_name?: string | null;
  variables?: Record<string, string>; // Manual variables + any overrides
  body?: string; // Optional: used for 'manual' template
  subject?: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

const META_GRAPH_VERSION = "v21.0";

function normalizePhone(num: string): string {
  return num.trim().replace(/^whatsapp:/i, "").replace(/^\+/, "").replace(/\D/g, "");
}

type MetaTemplate = {
  name: string;
  language: { code: string };
  components?: any[];
};

type ProviderResult = { ok: boolean; messageId?: string; error?: string; providerStatus?: string };

async function sendViaProvider(channel: Channel, to: string, body: string, templatePayload?: MetaTemplate): Promise<ProviderResult> {
  if (channel !== "whatsapp") {
    console.log(`[notification-stub] ${channel} -> ${to}: ${body}`);
    return { ok: true, messageId: `stub_${crypto.randomUUID()}` };
  }
  const accessToken = Deno.env.get("VITE_CHAKRAHQ_ACCESS_TOKEN") || Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("VITE_CHAKRAHQ_PHONE_NUMBER_ID") || Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID");
  const pluginId = Deno.env.get("VITE_CHAKRAHQ_PLUGIN_ID") || Deno.env.get("META_WHATSAPP_PLUGIN_ID");

  if (!accessToken || !phoneNumberId || !pluginId) {
    return { ok: false, error: "ChakraHQ not configured (Access Token, Phone Number ID, or Plugin ID missing)" };
  }

  try {
    const url = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${pluginId}/api/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;

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
    return { ok: true, messageId, providerStatus: "sent" };
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("MY_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.replace("Bearer ", "");
    let userId = "";

    if (token === serviceKey && serviceKey) {
      userId = "00000000-0000-0000-0000-000000000000";
    } else {
      const supabaseUserClient = createClient(supabaseUrl, anonKey);
      const { data: { user }, error: ce } = await supabaseUserClient.auth.getUser(token);
      if (ce || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized User JWT", details: ce }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = user.id;

      // Ensure user has allowed roles
      const adminAuthz = createClient(supabaseUrl, serviceKey);
      const { data: rolesData, error: rolesError } = await adminAuthz.from("user_roles").select("role").eq("user_id", userId);
      if (rolesError) {
        return new Response(JSON.stringify({ error: "Internal server error checking roles" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const allowedRoles = ["system_admin", "executive", "assistant", "project_manager", "branch_manager", "board"];
      const allowed = (rolesData?.map(r => r.role) || []).some(r => allowedRoles.includes(r));
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const payload = (await req.json()) as Payload;
    if (!payload?.template) {
      return new Response(JSON.stringify({ error: "template is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const channel: Channel = payload.channel ?? "whatsapp";
    const to = channel === "email" ? (payload.recipient_email ?? "") : (payload.recipient_phone ?? "");
    if (!to) {
      return new Response(JSON.stringify({ error: "recipient is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Fetch Template from DB
    let templateData: any = null;
    const { data: tpl, error: tplErr } = await admin.from("notification_templates").select("*").eq("key", payload.template).single();
    if (tplErr || !tpl) {
      return new Response(JSON.stringify({ error: `Template '${payload.template}' not found or inactive` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    templateData = tpl;

    // 2. Validate Manual Variables
    const variables = { ...(payload.variables ?? {}) };
    if (templateData && templateData.manual_variables) {
      const manualVars: string[] = templateData.manual_variables || [];
      const missingVars = manualVars.filter(v => !variables[v]);
      if (missingVars.length > 0) {
        return new Response(JSON.stringify({ error: `Missing manual variables: ${missingVars.join(", ")}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 3. Auto-fill Auto Variables from related_entity
    if (payload.related_entity_type === 'participant' && payload.related_entity_id) {
      const { data: pData } = await admin.from("participants")
        .select("full_name, projects(name_ar, manager_id, project_branches(name_ar))")
        .eq("id", payload.related_entity_id).single();
      if (pData) {
        if (!variables.participant_name) variables.participant_name = pData.full_name;
        if (pData.projects && !variables.project_name) variables.project_name = (pData.projects as any).name_ar;
      }
    }

    let body = payload.body ?? "";
    if (templateData && templateData.body_template) {
      body = templateData.body_template;
      for (const [key, val] of Object.entries(variables)) {
        body = body.replace(new RegExp(`\\{${key}\\}`, "g"), val as string);
      }
    }

    // 5. Save pending notification
    const { data: inserted, error: insErr } = await admin.from("notifications").insert({
      channel,
      recipient_phone: channel === "email" ? null : to,
      recipient_email: channel === "email" ? to : null,
      recipient_name: payload.recipient_name ?? variables.participant_name ?? null,
      subject: payload.subject ?? null,
      body,
      template: payload.template,
      related_entity_type: payload.related_entity_type ?? null,
      related_entity_id: payload.related_entity_id ?? null,
      status: "pending",
      created_by: userId,
    }).select().single();

    if (insErr || !inserted) {
      return new Response(JSON.stringify({ error: insErr?.message ?? "Insert failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 6. Send via Provider
    let providerResult: ProviderResult;
    if (channel === "whatsapp" && to) {
      const normalizedTo = normalizePhone(to);
      const { data: optOut } = await admin.from("whatsapp_opt_outs").select("id").eq("phone_number", normalizedTo).maybeSingle();

      if (optOut) {
        providerResult = { ok: false, error: "User opted out of WhatsApp messages" };
      } else {
        let isWithinWindow = false;
        const { data: session } = await admin.from("whatsapp_sessions").select("last_message_at").eq("phone_number", normalizedTo).maybeSingle();
        if (session?.last_message_at) {
          if (Date.now() - new Date(session.last_message_at).getTime() <= 24 * 60 * 60 * 1000) {
            isWithinWindow = true;
          }
        }

        let metaTemplate: MetaTemplate | undefined;
        const allVarsArray = (templateData?.variables || []).concat(templateData?.manual_variables || []);
        
        metaTemplate = {
          name: payload.template,
          language: { code: "ar" },
          components: []
        };

        if (templateData?.meta_components && Object.keys(templateData.meta_components).length > 0) {
          // Dynamic components construction based on meta_components mapping
          const mc = templateData.meta_components;
          if (mc.header && mc.header.length > 0) {
            metaTemplate.components!.push({
              type: "header",
              parameters: mc.header.map((vName: string) => ({ type: "text", text: variables[vName] || " " }))
            });
          }
          if (mc.body && mc.body.length > 0) {
            metaTemplate.components!.push({
              type: "body",
              parameters: mc.body.map((vName: string) => ({ type: "text", text: variables[vName] || " " }))
            });
          }
          // Loop over buttons (e.g. button_0, button_1)
          Object.keys(mc).forEach(k => {
            if (k.startsWith("button_")) {
              const bIdx = k.split("_")[1];
              if (mc[k] && mc[k].length > 0) {
                metaTemplate.components!.push({
                  type: "button",
                  sub_type: "url",
                  index: bIdx,
                  parameters: mc[k].map((vName: string) => ({ type: "text", text: variables[vName] || " " }))
                });
              }
            }
          });
        } else if (allVarsArray.length > 0) {
          // Fallback to purely body parameters
          const parameters = allVarsArray.map((vName: string) => ({
            type: "text",
            text: variables[vName] || " "
          }));
          metaTemplate.components!.push({
            type: "body",
            parameters
          });
        }

        providerResult = await sendViaProvider(channel, to, body, metaTemplate);
      }
    } else {
      providerResult = await sendViaProvider(channel, to, body);
    }

    // 7. Update status and metrics
    const notificationStatus = providerResult.ok ? "sent" : "failed";
    await admin.from("notifications").update({
      status: notificationStatus,
      provider_message_id: providerResult.messageId ?? null,
      error: providerResult.error ?? null,
      sent_at: providerResult.ok ? new Date().toISOString() : null,
    }).eq("id", inserted.id);

    // Update usage count
    if (templateData && providerResult.ok) {
      await admin.rpc('increment_template_usage', { tpl_key: payload.template }).catch(() => {
        // Safe fallback if RPC doesn't exist yet
        admin.from('notification_templates').update({
           usage_count: (templateData.usage_count || 0) + 1,
           last_used_at: new Date().toISOString()
        }).eq('key', payload.template).then();
      });
    }

    return new Response(JSON.stringify({ id: inserted.id, status: notificationStatus, error: providerResult.error ?? null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-notification error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
