#!/usr/bin/env node
/**
 * Smoke real do M8 (Aluno Graduado).
 * - Limite de monitor (trigger validate_graduated_monitor_limit).
 * - Alertas de score baixo (RPC check_and_create_low_score_alerts).
 * - get_graduated_students retorna lista correta.
 * - Mensagens entre graduado e aluno.
 * - coach_notes RLS (aluno NAO ve nota privada do treinador).
 *
 * Uso: node scripts/smoke-m8-graduated.mjs
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

  // === Setup base ===
  const treinador = await createUser({
    email: 'smoke_m8_trainer@test.local',
    full_name: 'smoke_m8_trainer',
    role: 'TREINADOR',
  });

  const grad1 = await createUser({
    email: 'smoke_m8_grad1@test.local',
    full_name: 'smoke_m8_grad1',
    role: 'ALUNO_GRADUADO',
  });
  const grad2 = await createUser({
    email: 'smoke_m8_grad2@test.local',
    full_name: 'smoke_m8_grad2',
    role: 'ALUNO_GRADUADO',
  });
  const grad3 = await createUser({
    email: 'smoke_m8_grad3@test.local',
    full_name: 'smoke_m8_grad3',
    role: 'ALUNO_GRADUADO',
  });

  // setar monitor_limit=2 no grad1
  await admin.from('profiles').update({ monitor_limit: 2 }).eq('id', grad1.id);

  const alunos = [];
  for (let i = 0; i < 5; i += 1) {
    const a = await createUser({
      email: `smoke_m8_aluno${i}@test.local`,
      full_name: `smoke_m8_aluno${i}`,
      role: 'ALUNO',
    });
    alunos.push(a);
  }

  const { data: program } = await admin
    .from('programs')
    .insert({ name: 'smoke_m8_program' })
    .select()
    .single();
  const { data: turma } = await admin
    .from('turmas')
    .insert({
      name: 'smoke_m8_turma',
      program_id: program.id,
      treinador_id: treinador.id,
      fechamento_dia: 0,
      fechamento_hora: '23:59',
      start_date: todayISO(),
      weeks_count: 12,
    })
    .select()
    .single();

  // Atribuir 2 alunos ao grad1 (no limite)
  for (let i = 0; i < 2; i += 1) {
    const { error } = await admin.from('enrollments').insert({
      aluno_id: alunos[i].id,
      turma_id: turma.id,
      status: 'active',
      graduated_monitor_id: grad1.id,
    });
    assert(!error, `M8 enrollment ${i} grad1 OK`);
  }

  // 3o aluno → deve falhar pelo trigger validate_graduated_monitor_limit
  const { error: limitErr } = await admin.from('enrollments').insert({
    aluno_id: alunos[2].id,
    turma_id: turma.id,
    status: 'active',
    graduated_monitor_id: grad1.id,
  });
  assert(
    limitErr && /Limite|excedido|limit/i.test(limitErr.message),
    `M8 limite de monitor enforced no DB: ${limitErr?.message || 'NAO BLOQUEOU'}`,
  );

  // Atribuir aluno[3] e aluno[4] ao grad2 (sem limite)
  await admin.from('enrollments').insert({
    aluno_id: alunos[3].id,
    turma_id: turma.id,
    status: 'active',
    graduated_monitor_id: grad2.id,
  });
  await admin.from('enrollments').insert({
    aluno_id: alunos[4].id,
    turma_id: turma.id,
    status: 'active',
    graduated_monitor_id: grad2.id,
  });

  // === Score baixo + alerts ===
  // Inserir cycle e 2 weekly_scores < 60 para alunos[0]
  const { data: cycle0 } = await admin
    .from('cycles')
    .insert({
      aluno_id: alunos[0].id,
      turma_id: turma.id,
      number: 1,
      status: 'active',
      start_date: daysAgo(21),
      weeks_count: 12,
    })
    .select()
    .single();

  await admin.from('weekly_scores').insert([
    {
      aluno_id: alunos[0].id,
      cycle_id: cycle0.id,
      week_number: 1,
      week_start_date: daysAgo(21),
      week_end_date: daysAgo(15),
      planned_tasks: 7,
      completed_tasks: 3,
      score: 42,
    },
    {
      aluno_id: alunos[0].id,
      cycle_id: cycle0.id,
      week_number: 2,
      week_start_date: daysAgo(14),
      week_end_date: daysAgo(8),
      planned_tasks: 7,
      completed_tasks: 3,
      score: 50,
    },
  ]);

  // Rodar check_and_create_low_score_alerts (RPC requires p_graduated_id)
  const { error: lscErr } = await admin.rpc('check_and_create_low_score_alerts', {
    p_graduated_id: grad1.id,
  });
  if (lscErr) console.log('  INFO check_and_create_low_score_alerts:', lscErr.message);
  assert(!lscErr, `M8 RPC check_and_create_low_score_alerts roda: ${lscErr?.message || ''}`);

  // Verificar que alert foi criado
  const { data: alerts } = await admin
    .from('low_score_alerts')
    .select('*')
    .eq('aluno_id', alunos[0].id);
  assert(
    (alerts || []).length >= 1,
    `M8 low_score_alert criado para aluno com 2 weeks < 60 (got ${alerts?.length})`,
  );

  // === get_graduated_students ===
  const cGrad1 = await loginAs(grad1.email, grad1.password);
  const { data: gradList, error: glErr } = await cGrad1.rpc('get_graduated_students', {
    p_graduated_id: grad1.id,
  });
  assert(!glErr, `M8 get_graduated_students sem erro: ${glErr?.message || ''}`);
  assert(
    (gradList || []).length === 2,
    `M8 grad1 vê 2 alunos (got ${gradList?.length})`,
  );

  // grad2 só ve 2 também (alunos 3 e 4)
  const cGrad2 = await loginAs(grad2.email, grad2.password);
  const { data: gradList2 } = await cGrad2.rpc('get_graduated_students', { p_graduated_id: grad2.id });
  assert((gradList2 || []).length === 2, `M8 grad2 ve 2 alunos (got ${gradList2?.length})`);

  // === Messages graduado <-> aluno ===
  // grad1 envia mensagem para alunos[0]
  const { data: msg1, error: m1err } = await cGrad1.rpc('send_message', {
    p_recipient_id: alunos[0].id,
    p_content: 'smoke_msg_grad_para_aluno',
  });
  assert(!m1err, `M8 graduado envia mensagem: ${m1err?.message || ''}`);

  // aluno responde
  const cAluno0 = await loginAs(alunos[0].email, alunos[0].password);
  const { error: m2err } = await cAluno0.rpc('send_message', {
    p_recipient_id: grad1.id,
    p_content: 'smoke_msg_aluno_para_grad',
  });
  assert(!m2err, `M8 aluno responde graduado: ${m2err?.message || ''}`);

  // ambos veem ambas as mensagens
  const { data: msgsGrad } = await cGrad1
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${grad1.id},recipient_id.eq.${grad1.id}`);
  assert((msgsGrad || []).length >= 2, `M8 graduado ve >=2 mensagens (got ${msgsGrad?.length})`);

  const { data: msgsAluno } = await cAluno0
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${alunos[0].id},recipient_id.eq.${alunos[0].id}`);
  assert((msgsAluno || []).length >= 2, `M8 aluno ve >=2 mensagens (got ${msgsAluno?.length})`);

  // RLS: grad2 NAO ve mensagens de grad1<->alunos[0]
  const { data: leakMsgs } = await cGrad2
    .from('messages')
    .select('*')
    .eq('sender_id', grad1.id);
  assert((leakMsgs || []).length === 0, 'M8 RLS: grad2 nao ve mensagens de outro graduado');

  // === coach_notes RLS ===
  // treinador insere coach_note para alunos[0]
  const cTrainer = await loginAs(treinador.email, treinador.password);
  const { error: cnErr } = await cTrainer.from('coach_notes').insert({
    aluno_id: alunos[0].id,
    treinador_id: treinador.id,
    content: 'smoke_nota_privada_treinador',
    tags: ['smoke'],
  });
  assert(!cnErr, `M8 treinador cria coach_note: ${cnErr?.message || ''}`);

  // aluno NAO ve a nota
  const { data: alunoNotes } = await cAluno0
    .from('coach_notes')
    .select('*')
    .eq('aluno_id', alunos[0].id);
  assert((alunoNotes || []).length === 0, `M8 RLS: aluno nao ve coach_note privada (got ${alunoNotes?.length})`);

  // treinador ve sua nota
  const { data: trainerNotes } = await cTrainer
    .from('coach_notes')
    .select('*')
    .eq('aluno_id', alunos[0].id);
  assert((trainerNotes || []).length >= 1, `M8 treinador ve sua coach_note (got ${trainerNotes?.length})`);

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
