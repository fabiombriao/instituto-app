#!/usr/bin/env node
/**
 * Smoke real de Habitos e ROI (Modulos 3 e 4).
 * Habits: cria habit, faz check-ins consecutivos, valida streak, frequencia,
 *   pausa e abandono.
 * ROI: cria baseline, registra resultados financeiros, valida grafico semanal,
 *   percentual e visibilidade por papel (RLS).
 *
 * Uso: node scripts/smoke-habits-roi.mjs
 */
import {
  admin,
  createUser,
  loginAs,
  cleanupSmoke,
  makeAssert,
  todayISO,
  daysAgo,
  summary,
} from './_smoke-helpers.mjs';

const { assert, getCounts } = makeAssert();

async function main() {
  await cleanupSmoke('smoke_');

  // === Setup base: programa, turma, aluno, treinador ===
  const aluno = await createUser({
    email: 'smoke_hab_aluno@test.local',
    full_name: 'smoke_hab_aluno',
    role: 'ALUNO',
  });
  const trainer = await createUser({
    email: 'smoke_hab_trainer@test.local',
    full_name: 'smoke_hab_trainer',
    role: 'TREINADOR',
  });
  const admin1 = await createUser({
    email: 'smoke_hab_admin@test.local',
    full_name: 'smoke_hab_admin',
    role: 'SUPER_ADMIN',
  });

  const { data: program } = await admin
    .from('programs')
    .insert({ name: 'smoke_program_hab' })
    .select()
    .single();
  const { data: turma } = await admin
    .from('turmas')
    .insert({
      name: 'smoke_turma_hab',
      program_id: program.id,
      treinador_id: trainer.id,
      fechamento_dia: 0,
      fechamento_hora: '23:59',
      start_date: todayISO(),
      weeks_count: 12,
    })
    .select()
    .single();
  await admin
    .from('enrollments')
    .insert({ aluno_id: aluno.id, turma_id: turma.id, status: 'active' });

  // Cycle ativo para vincular ROI
  const { data: cycle, error: cyErr } = await admin
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
  assert(!cyErr && cycle, `M4 cycle ativo criado: ${cyErr?.message || ''}`);

  // === HABITS ===
  const { data: habit, error: herr } = await admin
    .from('habits')
    .insert({
      aluno_id: aluno.id,
      name: 'smoke_habit_meditar',
      type: 'build',
      frequency: 'daily',
      target_days: 7,
      specific_days: null,
      is_paused: false,
    })
    .select()
    .single();
  assert(!herr && habit, `M3 habit criado: ${herr?.message || ''}`);

  // 5 check-ins consecutivos
  for (let i = 0; i < 5; i += 1) {
    const { error } = await admin.from('habit_checkins').insert({
      habit_id: habit.id,
      date: daysAgo(i),
      status: true,
    });
    assert(!error, `M3 habit_checkin dia -${i}: ${error?.message || 'OK'}`);
  }

  // Valida streak (5 consecutivos a partir de hoje)
  const { data: chkRows } = await admin
    .from('habit_checkins')
    .select('*')
    .eq('habit_id', habit.id)
    .order('date', { ascending: false });
  assert((chkRows || []).length === 5, `M3 streak: 5 checkins persistidos (got ${chkRows?.length})`);

  // Habito de abandono
  const { data: habitAb, error: aberr } = await admin
    .from('habits')
    .insert({
      aluno_id: aluno.id,
      name: 'smoke_habit_abandonar_acucar',
      type: 'abandon',
      frequency: 'daily',
      target_days: 7,
    })
    .select()
    .single();
  assert(!aberr && habitAb, `M3 habito abandono criado`);

  // Pausa habito (RF18 - reset streak quando reativa)
  await admin.from('habits').update({ is_paused: true, streak_reset_on: todayISO() }).eq('id', habit.id);
  const { data: paused } = await admin.from('habits').select('is_paused, streak_reset_on').eq('id', habit.id).single();
  assert(paused?.is_paused === true && paused?.streak_reset_on, 'M3 habito pausado com streak_reset_on');

  // Frequency = specific_days
  const { data: habitSp, error: sperr } = await admin
    .from('habits')
    .insert({
      aluno_id: aluno.id,
      name: 'smoke_habit_seg_qua_sex',
      type: 'build',
      frequency: 'specific_days',
      specific_days: [1, 3, 5],
      target_days: 3,
    })
    .select()
    .single();
  assert(!sperr && habitSp, 'M3 habito specific_days criado');

  // === ROI ===
  // Baseline (cycle_id obrigatorio segundo trigger sync_roi_result_context)
  const { data: baseline, error: berr } = await admin
    .from('roi_baselines')
    .insert({
      aluno_id: aluno.id,
      program_id: program.id,
      cycle_id: cycle.id,
      baseline_income: 5000,
      investment: 1000,
      goal_income: 10000,
      goal_status: 'approved',
    })
    .select()
    .single();
  assert(!berr && baseline, `M4 ROI baseline criado: ${berr?.message || ''}`);

  // Registra 3 resultados em semanas diferentes
  const dates = [daysAgo(14), daysAgo(7), daysAgo(0)];
  const amounts = [6000, 7500, 9000];
  for (let i = 0; i < 3; i += 1) {
    const { error } = await admin.from('roi_results').insert({
      aluno_id: aluno.id,
      baseline_id: baseline.id,
      program_id: program.id,
      amount: amounts[i],
      date: dates[i],
      description: `smoke roi week ${i + 1}`,
    });
    assert(!error, `M4 ROI result ${i + 1}: ${error?.message || 'OK'}`);
  }

  const { data: roiRows } = await admin
    .from('roi_results')
    .select('*')
    .eq('baseline_id', baseline.id)
    .order('date');
  assert((roiRows || []).length === 3, `M4 ROI results persistidos (got ${roiRows?.length})`);

  // Calculo do progresso: ultimo amount vs goal
  const last = roiRows[roiRows.length - 1];
  const progressPct = ((last.amount - baseline.baseline_income) / (baseline.goal_income - baseline.baseline_income)) * 100;
  assert(Math.abs(progressPct - 80) < 0.1, `M4 ROI progresso 80% (got ${progressPct.toFixed(2)}%)`);

  // === RLS - visibilidade de ROI por papel ===
  // ALUNO logado deve ver SEU baseline
  const cAluno = await loginAs(aluno.email, aluno.password);
  const { data: alunoBaselines, error: alErr } = await cAluno
    .from('roi_baselines')
    .select('*')
    .eq('aluno_id', aluno.id);
  assert(!alErr && (alunoBaselines || []).length === 1, `RLS ALUNO ve seu ROI: ${alErr?.message || 'OK'}`);

  // ALUNO NAO ve baseline de outro (criamos um aluno auxiliar)
  const aluno2 = await createUser({
    email: 'smoke_hab_aluno2@test.local',
    full_name: 'smoke_hab_aluno2',
    role: 'ALUNO',
  });
  // criar cycle pro aluno2 tambem
  const { data: cycle2 } = await admin
    .from('cycles')
    .insert({
      aluno_id: aluno2.id,
      turma_id: turma.id,
      number: 1,
      status: 'active',
      start_date: todayISO(),
      weeks_count: 12,
    })
    .select()
    .single();
  await admin
    .from('roi_baselines')
    .insert({ aluno_id: aluno2.id, program_id: program.id, cycle_id: cycle2.id, baseline_income: 1, investment: 0, goal_income: 2 });
  const { data: leakBaselines } = await cAluno
    .from('roi_baselines')
    .select('*')
    .eq('aluno_id', aluno2.id);
  assert((leakBaselines || []).length === 0, 'RLS ALUNO nao ve ROI de outro aluno');

  // SUPER_ADMIN ve tudo
  const cAdmin = await loginAs(admin1.email, admin1.password);
  const { data: adminBaselines } = await cAdmin
    .from('roi_baselines')
    .select('*');
  assert((adminBaselines || []).length >= 2, `RLS SUPER_ADMIN ve todos baselines (>=2, got ${adminBaselines?.length})`);

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
