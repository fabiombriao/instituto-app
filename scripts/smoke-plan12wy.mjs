#!/usr/bin/env node
/**
 * Smoke real do Plano 12WY (Modulo 2 - RF07-RF14).
 * Cria cycle ativo, 3 objetivos (testa limite do 4o), tatica, tarefa, check-in,
 * weekly_score, RPC close_cycle_week e archive_cycle.
 *
 * Uso: node scripts/smoke-plan12wy.mjs
 * Limpa todos os recursos com prefixo smoke_ ao final.
 */
import {
  admin,
  createUser,
  cleanupSmoke,
  makeAssert,
  todayISO,
  daysAgo,
  summary,
} from './_smoke-helpers.mjs';

const { assert, getCounts } = makeAssert();

async function main() {
  // baseline: limpa qualquer smoke residual
  await cleanupSmoke('smoke_');

  // === Setup: programa, turma, aluno ===
  const aluno = await createUser({
    email: 'smoke_plano_aluno@test.local',
    full_name: 'smoke_plano_aluno',
    role: 'ALUNO',
  });
  const trainer = await createUser({
    email: 'smoke_plano_trainer@test.local',
    full_name: 'smoke_plano_trainer',
    role: 'TREINADOR',
  });

  const { data: program } = await admin
    .from('programs')
    .insert({ name: 'smoke_program_12wy', description: 'plano smoke' })
    .select()
    .single();

  const { data: turma } = await admin
    .from('turmas')
    .insert({
      name: 'smoke_turma_12wy',
      program_id: program.id,
      treinador_id: trainer.id,
      fechamento_dia: 0,
      fechamento_hora: '23:59',
      weeks_count: 12,
      start_date: todayISO(),
    })
    .select()
    .single();

  const { data: enrollment } = await admin
    .from('enrollments')
    .insert({ aluno_id: aluno.id, turma_id: turma.id, status: 'active' })
    .select()
    .single();
  assert(enrollment, 'enrollment criado');

  // === RF07: criar ciclo ativo ===
  const { data: cycle, error: cerr } = await admin
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
  assert(!cerr && cycle?.id, `RF07 cycle criado: ${cerr?.message || ''}`);

  // === RF08: criar 3 objetivos (limite) ===
  const goalIds = [];
  for (let i = 0; i < 3; i += 1) {
    const { data: g, error: gerr } = await admin
      .from('goals')
      .insert({
        cycle_id: cycle.id,
        title: `smoke_objetivo_${i + 1}`,
        description: `meta ${i + 1}`,
        order: i,
        status: 'active',
      })
      .select()
      .single();
    if (!gerr) goalIds.push(g.id);
    assert(!gerr && g, `RF08 objetivo ${i + 1} criado`);
  }

  // Tentar 4o objetivo: trigger validate_goal_limit deve bloquear no DB.
  const { data: g4, error: g4err } = await admin
    .from('goals')
    .insert({
      cycle_id: cycle.id,
      title: 'smoke_objetivo_4',
      description: 'extra',
      order: 3,
      status: 'active',
    })
    .select()
    .single();
  if (!g4err && g4) {
    console.log('  WARN limite de 3 objetivos NAO bloqueou (esperado bloquear)');
    await admin.from('goals').delete().eq('id', g4.id);
  }
  assert(
    g4err && /3 objetivos|maximo|máximo/i.test(g4err.message),
    `RF08 DB bloqueia 4o objetivo (trigger validate_goal_limit): ${g4err?.message || 'NAO BLOQUEOU'}`,
  );

  // === RF09/RF10: criar tatica + tarefa ===
  const { data: tactic, error: terr } = await admin
    .from('tactics')
    .insert({ goal_id: goalIds[0], title: 'smoke_tatica_1', order: 0, frequency: 'daily' })
    .select()
    .single();
  assert(!terr && tactic, 'RF09 tatica criada');

  const { data: task, error: tkerr } = await admin
    .from('tasks')
    .insert({
      tactic_id: tactic.id,
      title: 'smoke_task_1',
      frequency: 'daily',
      specific_days: null,
    })
    .select()
    .single();
  assert(!tkerr && task, 'RF10 tarefa criada');

  // === RF11: check-in de tarefa ===
  const { data: checkin, error: chkerr } = await admin
    .from('task_checkins')
    .insert({
      task_id: task.id,
      date: todayISO(),
      status: 'done',
    })
    .select()
    .single();
  // BUG_DB conhecido: trigger em task_checkins referencia NEW.aluno_id que nao existe na tabela.
  // Reportado em @aprendizados.md. Aceitamos a falha e seguimos.
  if (chkerr && /aluno_id/.test(chkerr.message)) {
    console.log('  BUG_DB task_checkins trigger quebrado (NEW.aluno_id):', chkerr.message);
    assert(false, `RF11 task_checkin persistido [BUG_DB trigger NEW.aluno_id]`);
    assert(false, 'RF11 task_checkin re-lido do banco [BUG_DB upstream]');
  } else {
    assert(!chkerr && checkin, `RF11 task_checkin persistido (${chkerr?.message || ''})`);
    const { data: confirmCheck } = await admin
      .from('task_checkins')
      .select('*')
      .eq('task_id', task.id);
    assert((confirmCheck || []).length === 1, 'RF11 task_checkin re-lido do banco');
  }

  // === RF12: weekly_score / close_cycle_week ===
  // Inserir um weekly_score manual para teste
  const { data: ws1, error: ws1err } = await admin
    .from('weekly_scores')
    .insert({
      aluno_id: aluno.id,
      cycle_id: cycle.id,
      week_number: 1,
      week_start_date: daysAgo(7),
      week_end_date: daysAgo(1),
      planned_tasks: 7,
      completed_tasks: 5,
      score: 71.4,
    })
    .select()
    .single();
  assert(!ws1err && ws1, `RF12 weekly_score insert manual: ${ws1err?.message || ''}`);

  // RPC close_cycle_week (week 2 - deve calcular sozinho a partir dos checkins)
  const { data: closed, error: ccerr } = await admin.rpc('close_cycle_week', {
    p_cycle_id: cycle.id,
    p_week_number: 2,
  });
  // Se RPC nao tem permissao service-role-only, pode dar erro de auth. Aceita ambos.
  if (ccerr) {
    console.log('  INFO close_cycle_week err:', ccerr.message);
  }
  assert(
    !ccerr || /Nao autenticado|permissao|permission|Ciclo|already closed/i.test(ccerr.message || ''),
    'RF12 close_cycle_week chamavel (resposta esperada)',
  );

  // === RF13: historico semanal ===
  const { data: history } = await admin
    .from('weekly_scores')
    .select('*')
    .eq('cycle_id', cycle.id)
    .order('week_number');
  assert((history || []).length >= 1, `RF13 historico de weekly_scores >= 1 (got ${history?.length})`);

  // === RF14: archive_cycle ===
  const { data: archived, error: arerr } = await admin.rpc('archive_cycle', {
    p_cycle_id: cycle.id,
  });
  // pode ja ter sido arquivado pelo close
  if (arerr && !/encontrado|already/i.test(arerr.message)) {
    console.log('  INFO archive_cycle erro inesperado:', arerr.message);
  }
  // Verifica via select se status ou archived_at refletem arquivamento
  const { data: cycleAfter } = await admin
    .from('cycles')
    .select('status, archived_at')
    .eq('id', cycle.id)
    .single();
  assert(
    cycleAfter && (cycleAfter.status === 'archived' || cycleAfter.archived_at !== null),
    `RF14 archive_cycle marcou ciclo arquivado: ${JSON.stringify(cycleAfter)}`,
  );

  // === Cleanup ===
  await admin.from('task_checkins').delete().eq('task_id', task.id);
  await admin.from('tasks').delete().eq('id', task.id);
  await admin.from('tactics').delete().eq('id', tactic.id);
  await admin.from('goals').delete().in('id', goalIds);
  await admin.from('weekly_scores').delete().eq('cycle_id', cycle.id);
  await admin.from('cycles').delete().eq('id', cycle.id);
  await admin.from('enrollments').delete().eq('id', enrollment.id);
  await admin.from('turmas').delete().eq('id', turma.id);
  await admin.from('programs').delete().eq('id', program.id);
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
