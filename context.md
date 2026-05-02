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
- M8 Dashboard do Aluno Graduado foi fechado no app e no schema com listagem de alunos sob responsabilidade, alertas automaticos de baixo score, restricao de limite por graduado, visualizacao do dashboard do aluno sem ROI financeiro e integracao com notas privadas.
- M10 Notificacoes foi fechado no app com Bell + NotificationCenter no Shell, lembrete diario de habitos (UI ja existia), lembrete de fechamento semanal automatico, banner de alertas de score baixo no TrainerDashboard, push local de badge, canal bidirecional graduado<->aluno em /messages, /notifications com preferencias por tipo e canal, e migration `migrations/m10_notifications.sql` pronta para aplicar no Supabase. Push real (VAPID) fica reservado por falta de backend; notificacoes sao locais via `registration.showNotification`.
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
- M8 fechado no app e no schema com: campo `graduated_monitor_id` em `enrollments`, tabela `low_score_alerts` para rastreamento de alertas, RPC `get_graduated_students()` para listar alunos com metricas, RPC `check_and_create_low_score_alerts()` para automacao de alertas, trigger `validate_graduated_monitor_limit()` para respeitar limite de monitor, `GraduatedDashboard.tsx` com listagem, filtros, modal detalhes, refresh automatico de alertas a cada 5 min, navegacao para dashboard do aluno, rota `/graduated-dashboard` com guard de role `ALUNO_GRADUADO`, integracao com `coach_notes` via RLS.
- M9 fechado no app e schema com: RF52 consolidacao de streaks (funcoes `calculateHabitStreak` e `getCurrentHabitStreak`), RF53 ranking real baseado em score semanal (85% habitos 7d + 24% badges + 15% ROI + 16% streak), RF54 desbloqueio automatico de badges via RPC `check_and_unlock_badges()` com 7 regras e triggers, RF55 feed de conquistas da turma via RPC `get_team_achievements()` sem ROI, RF56 celebracao modal com animacoes em `BadgeUnlockCelebration.tsx`, hooks expandidos `useGamification()` com `checkAndUnlockBadges()` e novo `useTeamAchievements()`, integracao em `Dashboard.tsx` com rastreio de novas badges e celebracao auto-close.
- M10 fechado no app com: RF57 lembrete diario (UI ja existia em `Habits.tsx`, mantida), RF58 lembrete de fechamento semanal via RPC `should_send_weekly_closure_reminder` chamada pelo scheduler do `Shell.tsx` com cache em `localStorage` e log persistido em `notification_log`, RF59 banner de alertas de baixo score em `TrainerDashboard.tsx` consumindo RPC `get_trainer_low_score_alerts` com botoes Resolver/Dispensar via RPC `trainer_resolve_alert`, RF60 notificacao local + entry em `notification_log` para badges desbloqueadas em `Dashboard.tsx`, RF61/RF62 canal bidirecional graduado<->aluno em `src/pages/Messages.tsx` com RLS, RPCs `send_message`/`mark_message_read` e validacao de papel, RF63 `src/pages/NotificationSettings.tsx` com toggles por tipo (HABIT_REMINDER, WEEKLY_CLOSURE, LOW_SCORE_ALERT, BADGE_UNLOCK, MESSAGE_RECEIVED) e por canal (push/email/in_app) usando RPC `upsert_notification_preference`. Bell + NotificationCenter no `Shell.tsx` mostra contagem de nao lidas, marca lidas e linka para preferencias e mensagens. Migration aplicavel: `migrations/m10_notifications.sql` (notification_log, notification_preferences, messages, push_subscriptions, RLS e RPCs).

## Ainda Falta

- M3 Habitos: fechado no app; smoke real no Supabase de dev ainda opcional.
- M4 ROI: concluido no app, no schema e com smoke real validado no Supabase de dev.
- M6 Dashboard do Treinador fechado no app.
- M7 Dashboard do Super Admin fechado no app e no schema local; falta smoke real no Supabase de dev.
- Testes end-to-end de M8 com usuario real role ALUNO_GRADUADO e alunos atribuidos.
- M9 Gamificacao: Implementado RF52-RF56, pendente aplicar migration no Supabase de dev e smoke real.
- M10 Notificacoes: RF57-RF63 fechados no app, falta aplicar `migrations/m10_notifications.sql` no Supabase e smoke real (envio entre graduado e aluno, banner do treinador, fechamento semanal disparando).
- Expandir gestao de programas e turmas.
- Adicionar LGPD/auditoria, governanca e push real via VAPID com backend.

## Bem Encaminhado

- Login/sessao, recovery, verificacao de e-mail e shell de navegacao.
- Onboarding guiado com tooltips da primeira semana.
- Criacao/configuracao de turma e convites.
- Dashboard, Plano 12WY, Habitos, ROI, Ranking, AdminDashboard, GraduatedDashboard, Turma Setup e TurmaDetail.
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
- Modulo 8 - Aluno Graduado: RF47-RF51 fechados no app e no schema; testes end-to-end ainda pendentes.
- Modulo 9 - Gamificacao: RF52-RF56 fechados no app; migration m9_gamification.sql pronta para aplicar no Supabase; smoke real pendente.
- Modulo 10 - Notificacoes: RF57-RF63 fechados no app; migration `migrations/m10_notifications.sql` pronta para aplicar no Supabase; smoke real pendente.

## Gaps Transversais

- LGPD e auditoria de acesso a dados sensiveis ainda faltam.
- Logs de acesso ao ROI ainda faltam.
- Backup e confiabilidade operacional ainda faltam.
- Offline real com sync posterior ainda falta.
- PWA scaffold existe, mas push/offline robustos ainda nao.
- Performance e limites do PRD ainda nao foram validados ponta a ponta.
