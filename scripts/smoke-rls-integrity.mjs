#!/usr/bin/env node
/**
 * Smoke real de RLS e integridade.
 * Para tabelas sensiveis: ALUNO comum NAO consegue ler/alterar registros de outros.
 * SUPER_ADMIN consegue ler audit_log e tabelas globais.
 *
 * Tabelas testadas: profiles, roi_baselines, roi_results, coach_notes, messages,
 * audit_log, consent_log, roi_access_log, notification_log, notification_preferences.
 *
 * Uso: node scripts/smoke-rls-integrity.mjs
 */
import {
  admin,
  createUser,
  loginAs,
  cleanupSmoke,
  makeAssert,
  todayISO,
  summary,
} from './_smoke-helpers.mjs';

const { assert, getCounts } = makeAssert();

async function main() {
  await cleanupSmoke('smoke_');

  // === Setup ===
  const sa = await createUser({
    email: 'smoke_rls_admin@test.local',
    full_name: 'smoke_rls_admin',
    role: 'SUPER_ADMIN',
  });
  const trainer = await createUser({
    email: 'smoke_rls_trainer@test.local',
    full_name: 'smoke_rls_trainer',
    role: 'TREINADOR',
  });
  const aluno1 = await createUser({
    email: 'smoke_rls_aluno1@test.local',
    full_name: 'smoke_rls_aluno1',
    role: 'ALUNO',
  });
  const aluno2 = await createUser({
    email: 'smoke_rls_aluno2@test.local',
    full_name: 'smoke_rls_aluno2',
    role: 'ALUNO',
  });
  const grad = await createUser({
    email: 'smoke_rls_grad@test.local',
    full_name: 'smoke_rls_grad',
    role: 'ALUNO_GRADUADO',
  });

  const { data: program } = await admin
    .from('programs')
    .insert({ name: 'smoke_rls_program' })
    .select()
    .single();
  const { data: turma } = await admin
    .from('turmas')
    .insert({
      name: 'smoke_rls_turma',
      program_id: program.id,
      treinador_id: trainer.id,
      fechamento_dia: 0,
      fechamento_hora: '23:59',
      start_date: todayISO(),
      weeks_count: 12,
    })
    .select()
    .single();
  await admin.from('enrollments').insert([
    { aluno_id: aluno1.id, turma_id: turma.id, status: 'active' },
    { aluno_id: aluno2.id, turma_id: turma.id, status: 'active', graduated_monitor_id: grad.id },
  ]);

  const { data: cycle1 } = await admin
    .from('cycles')
    .insert({ aluno_id: aluno1.id, turma_id: turma.id, number: 1, status: 'active', start_date: todayISO(), weeks_count: 12 })
    .select()
    .single();
  const { data: cycle2 } = await admin
    .from('cycles')
    .insert({ aluno_id: aluno2.id, turma_id: turma.id, number: 1, status: 'active', start_date: todayISO(), weeks_count: 12 })
    .select()
    .single();

  // baselines/results para cada aluno
  const { data: bl1 } = await admin
    .from('roi_baselines')
    .insert({ aluno_id: aluno1.id, program_id: program.id, cycle_id: cycle1.id, baseline_income: 1000, goal_income: 5000 })
    .select()
    .single();
  const { data: bl2 } = await admin
    .from('roi_baselines')
    .insert({ aluno_id: aluno2.id, program_id: program.id, cycle_id: cycle2.id, baseline_income: 2000, goal_income: 6000 })
    .select()
    .single();
  await admin.from('roi_results').insert({
    aluno_id: aluno1.id,
    baseline_id: bl1.id,
    program_id: program.id,
    cycle_id: cycle1.id,
    amount: 2500,
    date: todayISO(),
  });
  await admin.from('roi_results').insert({
    aluno_id: aluno2.id,
    baseline_id: bl2.id,
    program_id: program.id,
    cycle_id: cycle2.id,
    amount: 3500,
    date: todayISO(),
  });

  // coach_note para aluno1 e aluno2
  await admin.from('coach_notes').insert([
    { aluno_id: aluno1.id, treinador_id: trainer.id, content: 'rls smoke note 1' },
    { aluno_id: aluno2.id, treinador_id: trainer.id, content: 'rls smoke note 2' },
  ]);

  // messages: aluno2->grad (valido) e grad->aluno2
  const cAluno2 = await loginAs(aluno2.email, aluno2.password);
  await cAluno2.rpc('send_message', { p_recipient_id: grad.id, p_content: 'msg from aluno2' });
  const cGrad = await loginAs(grad.email, grad.password);
  await cGrad.rpc('send_message', { p_recipient_id: aluno2.id, p_content: 'msg from grad' });

  // notification_log e preferences via cAluno2
  await cAluno2.rpc('log_notification', {
    p_type: 'HABIT_REMINDER',
    p_title: 'rls smoke notif',
    p_body: 'corpo',
    p_url: null,
    p_payload: {},
  });
  await cAluno2.rpc('upsert_notification_preference', {
    p_type: 'HABIT_REMINDER',
    p_push_enabled: true,
    p_email_enabled: false,
    p_in_app_enabled: true,
  });

  // consent_log e roi_access_log e audit_log via service role
  try {
    await admin.rpc('register_consent', { p_consent_type: 'LGPD', p_consented: true });
  } catch (e) {
    // ignore
  }
  // log_roi_access exige treinador acessando ROI de aluno
  const cTrainer = await loginAs(trainer.email, trainer.password);
  const { error: lraErr } = await cTrainer.rpc('log_roi_access', {
    p_target_user_id: aluno1.id,
  });
  if (lraErr) console.log('  INFO log_roi_access:', lraErr.message);

  // === ALUNO1 logado ===
  const cAluno1 = await loginAs(aluno1.email, aluno1.password);

  // profiles: aluno1 NAO pode UPDATE em outro
  const { error: pUpd } = await cAluno1
    .from('profiles')
    .update({ full_name: 'hacked' })
    .eq('id', aluno2.id);
  // Pode dar erro ou retornar 0 affected; o teste e tentar select pra ver se mudou
  const { data: aluno2After } = await admin.from('profiles').select('full_name').eq('id', aluno2.id).single();
  assert(
    aluno2After.full_name === 'smoke_rls_aluno2',
    `RLS profiles: aluno1 NAO altera profile de aluno2 (full_name=${aluno2After.full_name})`,
  );

  // roi_baselines: aluno1 NAO ve baseline do aluno2
  const { data: leakBl } = await cAluno1.from('roi_baselines').select('*').eq('aluno_id', aluno2.id);
  assert((leakBl || []).length === 0, `RLS roi_baselines: aluno1 nao ve baseline do aluno2 (got ${leakBl?.length})`);

  // roi_results: aluno1 NAO ve result do aluno2
  const { data: leakRr } = await cAluno1.from('roi_results').select('*').eq('aluno_id', aluno2.id);
  assert((leakRr || []).length === 0, `RLS roi_results: aluno1 nao ve result do aluno2 (got ${leakRr?.length})`);

  // coach_notes: aluno1 NAO ve coach_note do aluno2
  const { data: leakCn } = await cAluno1.from('coach_notes').select('*').eq('aluno_id', aluno2.id);
  assert((leakCn || []).length === 0, `RLS coach_notes: aluno1 nao ve coach_note do aluno2 (got ${leakCn?.length})`);

  // messages: aluno1 NAO ve mensagens entre aluno2 e grad
  const { data: leakMsg } = await cAluno1.from('messages').select('*').or(`sender_id.eq.${aluno2.id},recipient_id.eq.${aluno2.id}`);
  assert((leakMsg || []).length === 0, `RLS messages: aluno1 nao ve msgs alheias (got ${leakMsg?.length})`);

  // notification_log: aluno1 NAO ve notif do aluno2
  const { data: leakNl } = await cAluno1.from('notification_log').select('*').eq('user_id', aluno2.id);
  assert((leakNl || []).length === 0, `RLS notification_log: aluno1 nao ve do aluno2 (got ${leakNl?.length})`);

  // notification_preferences: aluno1 NAO ve preferencia do aluno2
  const { data: leakPref } = await cAluno1.from('notification_preferences').select('*').eq('user_id', aluno2.id);
  assert((leakPref || []).length === 0, `RLS notification_preferences: aluno1 nao ve do aluno2 (got ${leakPref?.length})`);

  // audit_log: aluno1 NAO consegue listar audit_log de outros
  const { data: leakAudit } = await cAluno1.from('audit_log').select('*');
  // pode retornar so as proprias acoes; mas nao pode ver de aluno2/sa
  const otherActor = (leakAudit || []).filter((a) => a.actor_user_id && a.actor_user_id !== aluno1.id);
  assert(
    otherActor.length === 0,
    `RLS audit_log: aluno1 nao ve actions de outros (got ${otherActor.length})`,
  );

  // consent_log: aluno1 NAO ve consent de outros
  const { data: leakConsent } = await cAluno1.from('consent_log').select('*');
  const otherConsent = (leakConsent || []).filter((c) => c.user_id && c.user_id !== aluno1.id);
  assert(otherConsent.length === 0, `RLS consent_log: aluno1 nao ve consent de outros (got ${otherConsent.length})`);

  // roi_access_log: aluno1 NAO ve log de acesso ao ROI alheio
  const { data: leakRal } = await cAluno1.from('roi_access_log').select('*');
  const otherRal = (leakRal || []).filter((r) => r.target_user_id && r.target_user_id !== aluno1.id);
  assert(otherRal.length === 0, `RLS roi_access_log: aluno1 nao ve acessos alheios (got ${otherRal.length})`);

  // === SUPER_ADMIN ===
  const cSA = await loginAs(sa.email, sa.password);

  // SA ve audit_log inteiro
  const { data: saAudit, error: saAuditErr } = await cSA.from('audit_log').select('*').limit(50);
  assert(!saAuditErr && Array.isArray(saAudit), `RLS audit_log: SA pode listar: ${saAuditErr?.message || ''}`);

  // SA ve roi_access_log
  const { data: saRal, error: saRalErr } = await cSA.from('roi_access_log').select('*').limit(50);
  assert(!saRalErr, `RLS roi_access_log: SA pode listar: ${saRalErr?.message || ''}`);

  // SA ve todos profiles
  const { data: saProfs } = await cSA.from('profiles').select('id,role').limit(100);
  assert((saProfs || []).length >= 5, `RLS profiles: SA ve todos (>=5, got ${saProfs?.length})`);

  // === Cleanup ===
  await cleanupSmoke('smoke_');
}

try {
  await main();
} catch (e) {
  console.error('CRASH', e);
  await cleanupSmoke('smoke_');
  process.exit(2);
}

const { pass, fail } = getCounts();
process.exit(summary(pass, fail));
