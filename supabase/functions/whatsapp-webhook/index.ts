import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);

    // 1. Meta Webhook Verification
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      // You can define a VITE_WEBHOOK_VERIFY_TOKEN in Supabase secrets if you want to secure it,
      // but typically we just echo back the challenge for simple setups.
      if (mode === "subscribe" && challenge) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Invalid verify token", { status: 403 });
    }

    if (req.method === "POST") {
      const payload = await req.json();
      console.log("Received Webhook Payload:", JSON.stringify(payload));

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("MY_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey);

      // 2. Parse Meta WhatsApp Webhook Payload
      if (payload.object === "whatsapp_business_account" && payload.entry) {
        for (const entry of payload.entry) {
          for (const change of entry.changes || []) {
            if (change.value && change.value.statuses) {
              for (const statusObj of change.value.statuses) {
                const wamid = statusObj.id; // provider_message_id
                let status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
                let errorMsg = null;

                if (status === 'failed') {
                  const error = statusObj.errors?.[0];
                  errorMsg = error ? `Meta WhatsApp [${error.code}]: ${error.title} - ${error.details || ''}` : "Unknown failure";
                }

                // Map statuses to our database logic if needed
                const updateData: any = { status };
                if (errorMsg) updateData.error = errorMsg;
                if (status === 'delivered') updateData.delivered_at = new Date(statusObj.timestamp * 1000).toISOString();
                if (status === 'read') updateData.read_at = new Date(statusObj.timestamp * 1000).toISOString();

                console.log(`Updating notification with wamid ${wamid} to status ${status}`);

                await admin.from("notifications")
                  .update(updateData)
                  .eq("provider_message_id", wamid)
                  .eq("channel", "whatsapp");
              }
            }
          }
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404 });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
