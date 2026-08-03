// Meta WhatsApp Cloud API webhook — receives delivery status updates.
// Public endpoint (verify_jwt = false). Configure in Meta App Dashboard →
// WhatsApp → Configuration → Webhooks. Subscribe to "messages" field.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map Meta status -> our notification_status enum
function mapStatus(metaStatus: string): string | null {
  const s = (metaStatus || "").toLowerCase();
  if (s === "sent") return "sent";
  if (s === "delivered") return "delivered";
  if (s === "read") return "read";
  if (s === "failed") return "failed";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // GET — Meta webhook verification handshake
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("META_WHATSAPP_VERIFY_TOKEN");
    if (mode === "subscribe" && verifyToken && expected && verifyToken === expected) {
      return new Response(challenge ?? "", { status: 200, headers: corsHeaders });
    }
    return new Response("forbidden", { status: 403, headers: corsHeaders });
  }

  try {
    // HMAC signature verification (Meta signs POST bodies with X-Hub-Signature-256)
    const appSecret = Deno.env.get("META_WHATSAPP_APP_SECRET");
    const rawBody = await req.text();
    if (appSecret) {
      const sig = req.headers.get("X-Hub-Signature-256") ?? "";
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(appSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const macBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
      const expected = "sha256=" + Array.from(new Uint8Array(macBuf))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      // Constant-time comparison
      if (expected.length !== sig.length) {
        return new Response("forbidden", { status: 403, headers: corsHeaders });
      }
      let diff = 0;
      for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
      if (diff !== 0) {
        return new Response("forbidden", { status: 403, headers: corsHeaders });
      }
    } else {
      console.warn("[meta-whatsapp-webhook] META_WHATSAPP_APP_SECRET not configured — signature verification skipped");
    }
    let body: any = {};
    try { body = JSON.parse(rawBody); } catch { body = {}; }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Meta payload structure:
    // { entry: [{ changes: [{ value: { statuses: [{ id, status, timestamp, errors? }] } }] }] }
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
        for (const st of statuses) {
          const messageId: string | undefined = st?.id;
          const mapped = mapStatus(st?.status);
          if (!messageId || !mapped) continue;

          const update: Record<string, unknown> = { status: mapped };
          const now = new Date().toISOString();
          if (mapped === "sent") update.sent_at = now;
          if (mapped === "delivered") update.delivered_at = now;
          if (mapped === "read") {
            update.read_at = now;
            update.delivered_at = now;
          }
          if (mapped === "failed") {
            const err = Array.isArray(st?.errors) && st.errors[0];
            const code = err?.code ? ` [${err.code}]` : "";
            const msg = err?.title ? `: ${err.title}` : err?.message ? `: ${err.message}` : "";
            update.error = `Meta WhatsApp failed${code}${msg}`;
          }

          await admin.from("notifications").update(update).eq("provider_message_id", messageId);
        }

        const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
        for (const msg of messages) {
          if (msg?.type === "text" && msg?.text?.body) {
            const bodyStr = msg.text.body.trim().toLowerCase();
            const from = msg.from;
            if (!from) continue;
            
            const stopKeywords = ["إيقاف", "قف", "stop", "unsubscribe", "إلغاء الاشتراك"];
            const startKeywords = ["إعادة", "ابدأ", "start", "subscribe", "اشتراك"];
            
            const normalizedFrom = from.replace(/^whatsapp:/i, "").replace(/^\+/, "").replace(/\D/g, "");

            await admin.from("whatsapp_sessions").upsert({
              phone_number: normalizedFrom,
              last_message_at: new Date().toISOString(),
            }, { onConflict: "phone_number" });

            if (stopKeywords.includes(bodyStr)) {
              await admin.from("whatsapp_opt_outs").upsert({
                phone_number: normalizedFrom,
                reason: `User sent stop keyword: ${bodyStr}`,
              }, { onConflict: "phone_number" });
            } else if (startKeywords.includes(bodyStr)) {
              await admin.from("whatsapp_opt_outs").delete().eq("phone_number", normalizedFrom);
            }
          }
        }
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("meta-whatsapp-webhook error:", e);
    // Always return 200 so Meta doesn't disable the webhook
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});
