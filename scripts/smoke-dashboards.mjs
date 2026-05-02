#!/usr/bin/env node
/**
 * Smoke real dos dashboards por papel.
 * Para cada role (ALUNO, TREINADOR, SUPER_ADMIN, ALUNO_GRADUADO) cria usuario,
 * loga, valida que as queries principais do dashboard funcionam dentro da RLS.
 *
 * Uso: node scripts/smoke-dashboards.mjs
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

  // === Setup base ===
  const sa = await createUser({
    email: 'smoke_dash_admin@test.local',
    full_name: 'smoke_dash_admin',
    role: 'SUPER_ADMIN',
  });
  const treinador = await createUser({
    email: 'smoke_dash_trainer@test.local',
    full_name: 'smoke_dash_trainer',
    role: 'TREINADOR',
  });
  const aluno = await createUser({
    email: 'smoke_dash_aluno@test.local',
    full_name: 'smoke_dash_aluno',
    role: 'ALUNO',
  });
  const grad = await createUser({
    email: 'smoke_dash_grad@test.local',
    full_name: 'smoke_dash_grad',
    role: 'ALUNO_GRADUADO',
  });

  const { data: program } = await admin
    .from('programs')
    .insert({ name: 'smoke_dash_program' })
    .select()
    .single();
  const { data: turma } = await admin
    .from('turmas')
    .insert({
      name: 'smoke_dash_turma',
      program_id: program.id,
      treinador_id: treinador.id,
      fechamento_dia: 0,
      fechamento_hora: '23:59',
      start_date: todayISO(),
      weeks_count: 12,
    })
    .select()
    .single();

  const { data: enr0, error: enr0err } = await admin
    .from('enrollments')
    .insert({ aluno_id: aluno.id, turma_id: turma.id, status: 'active', graduated_monitor_id: grad.id })
    .select()
    .single();
  assert(!enr0err && enr0?.id, `Setup enrollment criado: ${enr0err?.message || ''}`);

  // criar ciclo do aluno
  const { data: cycle } = await admin
    .from('cycles')
    .insert({
      aluno_id: aluno.id,
      turma_id: turma.id,
      number: 1,
      status: 'active',
      start_date: todayISO(),
      weeks_count: 12,
    })
    .select()
    .single();

  // === ALUNO ===
  const cAluno = await loginAs(aluno.email, aluno.password);
  const { data: alunoProfile, error: alpErr } = await cAluno
    .from('profiles')
    .select('*')
    .eq('id', aluno.id)
    .single();
  assert(!alpErr && alunoProfile?.role === 'ALUNO', `ALUNO ve seu profile: ${alpErr?.message || ''}`);

  const { data: alunoCycles } = await cAluno.from('cycles').select('*').eq('aluno_id', aluno.id);
  assert((alunoCycles || []).length === 1, `ALUNO ve seu cycle ativo (got ${alunoCycles?.length})`);

  const { data: alunoBadges } = await cAluno.from('user_badges').select('*');
  assert(Array.isArray(alunoBadges), 'ALUNO consegue listar suas badges');

  // === TREINADOR ===
  const cTrainer = await loginAs(treinador.email, treinador.password);
  const { data: trainerTurmas, error: ttErr } = await cTrainer
    .from('turmas')
    .select('*')
    .eq('treinador_id', treinador.id);
  assert(!ttErr && (trainerTurmas || []).length >= 1, `TREINADOR ve suas turmas: ${ttErr?.message || ''}`);

  const { data: trainerEnrollments, error: teErr } = await cTrainer
    .from('enrollments')
    .select('*')
    .eq('turma_id', turma.id);
  assert(!teErr && (trainerEnrollments || []).length >= 1, `TREINADOR ve enrollments da turma: ${teErr?.message || ''}`);

  // get_trainer_low_score_alerts (RPC ja existente)
  const { error: lsErr } = await cTrainer.rpc('get_trainer_low_score_alerts');
  assert(!lsErr, `TREINADOR pode chamar get_trainer_low_score_alerts: ${lsErr?.message || ''}`);

  // === SUPER_ADMIN ===
  const cSA = await loginAs(sa.email, sa.password);
  const { data: allProfiles, error: apErr } = await cSA.from('profiles').select('id,role').limit(100);
  assert(!apErr && (allProfiles || []).length >= 4, `SA ve todos profiles (>=4, got ${allProfiles?.length})`);

  const { data: allPrograms } = await cSA.from('programs').select('*');
  assert((allPrograms || []).length >= 1, 'SA ve programs');

  const { data: allTurmas } = await cSA.from('turmas').select('*');
  assert((allTurmas || []).length >= 1, 'SA ve turmas');

  // === ALUNO_GRADUADO ===
  const cGrad = await loginAs(grad.email, grad.password);
  const { data: gradStudents, error: gsErr } = await cGrad.rpc('get_graduated_students', {
    p_graduated_id: grad.id,
  });
  // RPC retorna array de alunos sob responsabilidade
  assert(
    !gsErr && Array.isArray(gradStudents),
    `ALUNO_GRADUADO chama get_graduated_students: ${gsErr?.message || ''}`,
  );
  assert(
    (gradStudents || []).some((s) => s.aluno_id === aluno.id),
    `get_graduated_students retorna o aluno atribuido (got ${gradStudents?.length} alunos)`,
  );

  // ALUNO_GRADUADO NAO ve ROI financeiro de outros (RLS)
  // criar baseline para o aluno e tentar selecionar pelo grad
  await admin
    .from('roi_baselines')
    .insert({
      aluno_id: aluno.id,
      program_id: program.id,
      cycle_id: cycle.id,
      baseline_income: 1000,
      goal_income: 5000,
    });
  const { data: gradROI } = await cGrad.from('roi_baselines').select('*').eq('aluno_id', aluno.id);
  // can_view_financial_roi geralmente NAO inclui ALUNO_GRADUADO; aceitamos vazio
  assert((gradROI || []).length === 0, `ALUNO_GRADUADO nao ve ROI financeiro de outros (got ${gradROI?.length})`);

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
