## Resumo Operacional

- App interno do Instituto Caminhos do Êxito para alunos, turmas, habitos, ROI, ciclo 12WY, ranking e admin.
- Stack: React + Vite + Supabase.
- Dev ligado ao Supabase de `.env.dev`.

## Estado Atual

- M1 concluido no app e no banco de dev.
- M2 concluido no app e no Supabase de dev.
- Signup, recovery, first access, turma setup, convites e aceite ja ligados as rotas e ao Supabase.
- Onboarding grava `onboarding_completed_at` e cria base inicial de programa, ciclo, objetivo, tatica, tarefa, habito e ROI baseline com `cycle_id` e meta negociada.
- `Dashboard` mostra habitos, ROI, ciclo ativo, vinculos e badges reais, com ROI oculto para papeis sem acesso financeiro.
- M5 Dashboard do Aluno foi fechado no app com score da semana, tendencia, streak, ROI acumulado, proximas tarefas, acao de hoje, ciclo resumido, feed de conquistas e atalhos para Plano, Habitos, ROI e Turma.
- M6 Dashboard do Treinador foi fechado no app com visao consolidada por turma, lista ordenavel de alunos com score/streak/ROI, dashboard detalhado do aluno, filtros por status, grafico coletivo de scores semanais, exportacao PDF individual e da turma, e fluxo completo de notas privadas com CRUD e tags.
- M7 Dashboard do Super Admin foi fechado no app e no schema local com visao global de programas, turmas e alunos ativos, metricas globais, gestao de programas arquivaveis, gestao de turmas, convites de usuario, desativacao de perfis e limite de monitor por graduado.
- `Signup` aceita convite por token, trava o e-mail quando veio do link e conclui a aceitacao do convite quando a sessao do novo usuario fica disponivel.
- `/admin` ficou restrito a `SUPER_ADMIN`; `TREINADOR` segue no dashboard proprio.
- `Plano 12WY` agora cobre ciclo, objetivos, taticas, tarefas, check-ins, score semanal, score acumulado, historico semanal, visao por dia e a modelagem/UX de objetivos, taticas e tarefas do RF08.
- `Habitos` usa `type`, `frequency`, `specific_days`, `target_days`, `streak_reset_on` e `is_paused`.
- `ROI` usa `baseline_income`, `investment`, `goal_income`, `cycle_id` e `baseline_id`.
- `Ranking` calcula score real com habitos, badges e ROI e respeita a visibilidade por papel.
- `AdminDashboard` usa papeis reais, notas privadas, programas, turmas, membros e governanca de super admin.
- `Turma Setup` lista turmas e abre a pagina dedicada.
- `TurmaDetail` existe para membros, convites e resumo.
- `InviteAccept` mostra rotulo padronizado da turma, nao o ID cru.
- M7 data contract e enforcement ficaram prontos no banco e no hook: `profiles.disabled_at`, `profiles.monitor_limit`, `programs.archived_at`, `user_invites`, RPCs de convite e de administracao, resumo de monitores e bloqueio de limite por monitor em `enrollments`.
- PWA/offline scaffoldado.
- Build validado.
- `localhost` voltou e o crash em `/plano` foi corrigido.
- M4 ROI fechou no app e no schema: baseline/ciclo, grafico semanal, bloqueio por papel e meta negociada ja foram conectados e validados com smoke real.

## Melhorias Feitas

- Front, types e banco alinhados ao schema real do Supabase de dev.
- Tabelas criadas: `badges`, `user_badges`, `enrollments`, `coach_notes`, `turma_invites`.
- `profiles.onboarding_completed_at` adicionado.
- RPCs de convite: `get_turma_invite_by_token` e `accept_turma_invite`.
- Rotas em `src/App.tsx`: `/verify-email`, `/forgot-password`, `/reset-password`, `/invite/:token`, `/onboarding`, `/turma/setup`, `/turma/:turmaId`.
- `refreshProfile()` adicionado no auth context.
- `Database` generic removido do client Supabase.
- Seed de badges normalizada.
- Links quebrados, loaders presos e contratos antigos ajustados.
- RLS de onboarding/turma ajustado; recursao entre `turmas` e `enrollments` corrigida.
- `npm run lint`, `npm run build` e smoke tests no Supabase de dev validados.
- M2 fechado com `weekly_scores`, RPCs `close_cycle_week` e `archive_cycle`, limite de 3 objetivos, historico semanal persistido, score acumulado e modelagem/UX do RF08.
- `src/hooks/useData.ts` separa ciclo ativo/arquivado e usa atualizacao otimista no `createCycle`.
- `src/pages/Plan12WY.tsx` bloqueia o 4o objetivo, suporta ciclo arquivado, historico semanal, score acumulado e visao por dia.
- `src/lib/supabase.ts` ganhou timeout anti-spinner infinito.
- `src/context/AuthContext.tsx` deixou de segurar lock de auth no `onAuthStateChange` e consome convite pendente quando a sessao aparece.
- `src/hooks/useData.ts` ganhou helpers tipados de admin e CRUD via RPC para programa arquivado, desativacao/reativacao de perfil, limite de monitor, convites de usuario e atribuicao de monitor.
- Dados smoke/example removidos do Supabase; ficou so `fabiomoralesbriao@gmail.com`.
- `src/lib/turmaLabel.ts` padroniza nome de turma/convite.
- `src/pages/TurmaDetail.tsx` e rota `/turma/:turmaId` criadas.
- Centro de Comando e `Turma Setup` agora exibem programas, turmas e membros.
- M3 fechado no app com check-in unico, streak por habito, heatmap estilo GitHub, habito de abandono, pausa com reset de streak e lembrete diario configuravel.
- Lembrete diario ficou persistido em `profiles.habit_reminder_enabled` e `profiles.habit_reminder_time`, com scheduler local no `Shell` e plumbing de `push` no `public/sw.js`.
- `src/hooks/useData.ts` agora centraliza `isHabitDueOnDate`, `calculateHabitStreak`, heatmap e consistencia por habito.
- `npm run build` passou; `npm run lint` ainda acusava um erro preexistente em `src/pages/Ranking.tsx` antes do fechamento recente; localhost voltou em `http://127.0.0.1:3000`.

## Ainda Falta

- M3 Habitos: fechado no app; smoke real no Supabase de dev ainda opcional.
- M4 ROI: concluido no app, no schema e com smoke real validado no Supabase de dev.
- M6 Dashboard do Treinador fechado no app.
- M7 Dashboard do Super Admin fechado no app e no schema local; falta smoke real no Supabase de dev.
- M8 Aluno Graduado ainda incompleto.
- Automatizar desbloqueio de badges por regra.
- Expandir gestao de programas e turmas.
- Adicionar notificacoes, LGPD/auditoria e governanca.

## Bem Encaminhado

- Login/sessao, recovery, verificacao de e-mail e shell de navegacao.
- Onboarding guiado com tooltips da primeira semana.
- Criacao/configuracao de turma e convites.
- Dashboard, Plano 12WY, Habitos, ROI, Ranking, AdminDashboard, Turma Setup e TurmaDetail.
- Habitos ja com fluxo simples de check-in, streak/reset e lembrete diario configuravel.
- Integracao com Supabase de dev.
- BadgesGrid e scaffold de PWA/offline.
- Banco de dev alinhado com boa parte do contrato.
- Dados smoke/example removidos do banco.

## Pendencias Por Modulo

- Modulo 2 - Plano 12 Week Year: RF07-RF14 fechados.
- Modulo 3 - Habitos: fechado no app; smoke real no Supabase de dev ainda opcional.
- Modulo 4 - ROI: concluido no app, no schema e com smoke real validado no Supabase de dev.
- Modulo 5 - Dashboard do Aluno: RF28-RF32 fechados.
- Modulo 6 - Dashboard do Treinador: RF33-RF40 fechados.
- Modulo 7 - Dashboard do Super Admin: RF41-RF46 fechados no app e no schema local; smoke real no Supabase de dev ainda pendente.
- Modulo 8 - Aluno Graduado: RF47-RF51 pendentes.
- Modulo 9 - Gamificacao: RF52 parcial; RF54-RF56 pendentes; RF53 fechado.
- Modulo 10 - Notificacoes: RF57-RF63 pendentes.

## Gaps Transversais

- LGPD e auditoria de acesso a dados sensiveis ainda faltam.
- Logs de acesso ao ROI ainda faltam.
- Backup e confiabilidade operacional ainda faltam.
- Offline real com sync posterior ainda falta.
- PWA scaffold existe, mas push/offline robustos ainda nao.
- Performance e limites do PRD ainda nao foram validados ponta a ponta.
