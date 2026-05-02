// Helpers compartilhados para os smokes de validacao final.
// Cria/limpa usuarios com tag smoke_ e abstrai supabase admin/anon.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

export const SUPA_URL = process.env.SUPABASE_PROJECT_URL;
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_SECRET;
export const ANON_KEY = process.env.SUPABASE_ANON_PUBLIC_KEY;

if (!SUPA_URL || !SERVICE_KEY || !ANON_KEY) {
  throw new Error('Faltam env vars SUPABASE_PROJECT_URL/SERVICE_ROLE/ANON em .env');
}

export const admin = createClient(SUPA_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export function anonClient() {
  return createClient(SUPA_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

// Cria usuario via admin api com email_confirm=true e ja insere row em profiles.
export async function createUser({ email, full_name, role, password = 'SmokeTest!2025', monitor_limit = null }) {
  const { data: u, error: uerr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (uerr) throw new Error(`createUser ${email}: ${uerr.message}`);
  const userId = u.user.id;

  // upsert profile (handle_new_user trigger pode ja ter criado)
  const profilePayload = { id: userId, email, full_name, role };
  const { error: perr } = await admin
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' });
  if (perr) throw new Error(`profile upsert ${email}: ${perr.message}`);

  return { id: userId, email, password, full_name, role, monitor_limit };
}

export async function loginAs(email, password) {
  const c = anonClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

// Limpa todos os artefatos com email/name iniciado em smoke_
export async function cleanupSmoke(prefix = 'smoke_') {
  // 1) achar profiles smoke_
  const { data: profs } = await admin
    .from('profiles')
    .select('id, email')
    .like('email', `${prefix}%`);
  const ids = (profs || []).map((p) => p.id);

  if (ids.length === 0) return { deleted: 0 };

  // 2) deletar dependencias por aluno_id
  for (const t of ['habit_checkins']) {
    // habit_checkins refere habit_id; pegar habits do aluno e deletar
  }
  // Habit checkins -> precisa via habits.id
  const { data: habits } = await admin.from('habits').select('id').in('aluno_id', ids);
  const habitIds = (habits || []).map((h) => h.id);
  if (habitIds.length) {
    await admin.from('habit_checkins').delete().in('habit_id', habitIds);
    await admin.from('habits').delete().in('id', habitIds);
  }

  // task_checkins -> precisa via tasks.id -> tactics.id -> goals.id -> cycles.id (aluno_id)
  const { data: cycles } = await admin.from('cycles').select('id').in('aluno_id', ids);
  const cycleIds = (cycles || []).map((c) => c.id);
  if (cycleIds.length) {
    const { data: goals } = await admin.from('goals').select('id').in('cycle_id', cycleIds);
    const goalIds = (goals || []).map((g) => g.id);
    if (goalIds.length) {
      const { data: tactics } = await admin.from('tactics').select('id').in('goal_id', goalIds);
      const tacticIds = (tactics || []).map((t) => t.id);
      if (tacticIds.length) {
        const { data: tasks } = await admin.from('tasks').select('id').in('tactic_id', tacticIds);
        const taskIds = (tasks || []).map((t) => t.id);
        if (taskIds.length) {
          await admin.from('task_checkins').delete().in('task_id', taskIds);
          await admin.from('tasks').delete().in('id', taskIds);
        }
        await admin.from('tactics').delete().in('id', tacticIds);
      }
      await admin.from('goals').delete().in('id', goalIds);
    }
    await admin.from('weekly_scores').delete().in('cycle_id', cycleIds);
    await admin.from('cycles').delete().in('id', cycleIds);
  }

  // Outras tabelas que apontam para aluno_id/user_id
  const userScopedTables = [
    ['roi_results', 'aluno_id'],
    ['roi_baselines', 'aluno_id'],
    ['low_score_alerts', 'aluno_id'],
    ['user_badges', 'user_id'],
    ['notification_log', 'user_id'],
    ['notification_preferences', 'user_id'],
    ['enrollments', 'aluno_id'],
    ['enrollments', 'monitor_id'],
    ['enrollments', 'graduated_monitor_id'],
    ['coach_notes', 'aluno_id'],
    ['coach_notes', 'treinador_id'],
    ['messages', 'sender_id'],
    ['messages', 'recipient_id'],
    ['audit_log', 'actor_user_id'],
    ['audit_log', 'target_user_id'],
    ['turma_invites', 'created_by'],
    ['turma_invites', 'accepted_by'],
  ];
  for (const [tbl, col] of userScopedTables) {
    await admin.from(tbl).delete().in(col, ids);
  }

  // Programs/turmas com nome smoke_
  await admin.from('turmas').delete().like('name', `${prefix}%`);
  await admin.from('programs').delete().like('name', `${prefix}%`);

  // Por fim, deletar profiles e auth users
  for (const id of ids) {
    await admin.from('profiles').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }

  return { deleted: ids.length };
}

// Summary helper
export function summary(pass, fail) {
  console.log('');
  console.log(`Total: ${pass} pass, ${fail} fail`);
  return fail === 0 ? 0 : 1;
}

export function nowIso() {
  return new Date().toISOString();
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function makeAssert() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  function assert(cond, label) {
    if (cond) {
      console.log(`  PASS  ${label}`);
      pass += 1;
    } else {
      console.error(`  FAIL  ${label}`);
      fail += 1;
      failures.push(label);
    }
  }
  function getCounts() {
    return { pass, fail, failures };
  }
  return { assert, getCounts };
}
