// Edge Function: send-push
// --------------------------------------------------
// Recebe { user_ids, title, body, url, data } e envia Web Push (VAPID)
// para todas as subscriptions registradas em `push_subscriptions`.
//
// Variaveis de ambiente esperadas (Supabase Functions Secrets):
//   - VAPID_PUBLIC_KEY
//   - VAPID_PRIVATE_KEY
//   - VAPID_SUBJECT (ex: mailto:fabiomoralesbriao@gmail.com)
//   - SUPABASE_URL (auto)
//   - SUPABASE_SERVICE_ROLE_KEY (Edge Function Secrets)
//
// Deploy manual:
//   supabase functions deploy send-push
//
// Invocacao client:
//   supabase.functions.invoke('send-push', { body: { user_ids, title, body, url } })
//
// IMPORTANTE: Em DEV, se as VAPID keys nao estiverem configuradas, o cliente
// usa fallback local via showLocalNotification() (ver src/lib/pushSubscription.ts).

// @ts-ignore - Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore - Deno runtime
import webpush from "https://esm.sh/web-push@3.6.7";

interface Payload {
  user_ids: string[];
  title: string;
  body?: string;
  url?: string;
  data?: Record<string, unknown>;
}

// @ts-ignore - Deno
declare const Deno: { env: { get(name: string): string | undefined } };

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!payload.user_ids || !Array.isArray(payload.user_ids) || payload.user_ids.length === 0) {
    return jsonResponse({ error: "user_ids is required" }, 400);
  }
  if (!payload.title) {
    return jsonResponse({ error: "title is required" }, 400);
  }

  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@caminhosdoexito.app";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return jsonResponse(
      { error: "VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets." },
      503,
    );
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Supabase env vars missing in function" }, 500);
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, keys, user_id")
    .in("user_id", payload.user_ids);

  if (error) {
    return jsonResponse({ error: `Failed to read subscriptions: ${error.message}` }, 500);
  }

  if (!subs || subs.length === 0) {
    return jsonResponse({ success: true, sent: 0, message: "No subscriptions for users" });
  }

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/",
    data: payload.data ?? {},
  });

  const expiredEndpoints: string[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: sub.keys as { auth: string; p256dh: string },
        },
        notification,
      );
      successCount += 1;
    } catch (err: any) {
      errorCount += 1;
      const status = err?.statusCode ?? 0;
      if (status === 404 || status === 410) {
        expiredEndpoints.push(sub.endpoint as string);
      }
    }
  }

  // Limpar subscriptions expiradas
  if (expiredEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expiredEndpoints);
  }

  return jsonResponse({
    success: true,
    sent: successCount,
    failed: errorCount,
    expired_removed: expiredEndpoints.length,
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
