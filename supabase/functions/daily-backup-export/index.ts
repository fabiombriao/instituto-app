// Edge Function: daily-backup-export
// --------------------------------------------------
// Exporta JSON das tabelas criticas para o bucket Storage `backups`.
// Recomenda-se executar via Supabase Cron (1x por dia, idealmente 03:00 BRT).
//
// Variaveis de ambiente (auto):
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//
// Pre-requisitos:
//   1. Bucket `backups` (privado) criado no Storage.
//   2. Cron schedule (Supabase Studio > Database > Cron) chamando:
//        select net.http_post(
//          url := '<SUPABASE_URL>/functions/v1/daily-backup-export',
//          headers := jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>')
//        );
//
// Deploy manual:
//   supabase functions deploy daily-backup-export

// @ts-ignore - Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore - Deno
declare const Deno: { env: { get(name: string): string | undefined } };

const TABLES = [
  "profiles",
  "programs",
  "turmas",
  "enrollments",
  "cycles",
  "goals",
  "tactics",
  "tasks",
  "task_checkins",
  "weekly_scores",
  "habits",
  "habit_checkins",
  "roi_baselines",
  "roi_results",
  "badges",
  "user_badges",
  "coach_notes",
  "user_invites",
  "turma_invites",
  "messages",
  "notification_log",
  "notification_preferences",
  "push_subscriptions",
  "audit_log",
  "consent_log",
  "roi_access_log",
];

Deno.serve(async (_req: Request): Promise<Response> => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing env" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const dump: Record<string, unknown> = {
    backup_at: new Date().toISOString(),
    schema_version: "m11",
    tables: {},
  };

  const errors: Record<string, string> = {};
  const counts: Record<string, number> = {};

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        errors[table] = error.message;
        continue;
      }
      (dump.tables as Record<string, unknown[]>)[table] = data ?? [];
      counts[table] = (data ?? []).length;
    } catch (err: any) {
      errors[table] = err?.message ?? String(err);
    }
  }

  // Salva no bucket backups/YYYY-MM-DD.json
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${today}.json`;
  const body = new Blob([JSON.stringify(dump)], { type: "application/json" });

  try {
    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(filename, body, { upsert: true, contentType: "application/json" });
    if (uploadError) {
      return jsonResponse(
        { ok: false, upload_error: uploadError.message, counts, errors },
        500,
      );
    }
  } catch (err: any) {
    return jsonResponse(
      { ok: false, upload_error: err?.message ?? String(err), counts, errors },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    filename,
    counts,
    errors,
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
