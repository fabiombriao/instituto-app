# Microtasks Pendentes

## Mapa de subagents

- Franklin: RF01-RF06, com foco em autenticacao, onboarding, convite e primeiro acesso.
- Cicero: RF07-RF14, com foco no fluxo do Plano 12WY, score, historico e visao semanal.
- Halley: validacao transversal, scripts de teste, integracao com o Supabase de dev e fechamento final.

## Ordem Sugerida

1. Fechar autenticacao e onboarding, porque isso destrava o primeiro acesso e a criacao de turma.
2. Fechar o Plano 12WY, porque ele depende da base de ciclo, tarefa e check-in.
3. Revisar Habitos e ROI, que ja existem parcialmente mas ainda precisam da regra oficial do produto.
4. Completar dashboards, gamificacao e notificacoes.
5. Fechar governanca, LGPD, offline e validacao final com banco de dev.

## Microtasks

### M1 - Autenticacao & Onboarding

- (x) RF01: fechar cadastro com verificacao de e-mail e tratamento de usuario pendente de confirmacao, ajustando `src/pages/Signup.tsx`, `src/context/AuthContext.tsx` e as mensagens de status.
- (x) RF02: implementar recovery de senha como fluxo completo, incluindo tela/acao de redefinicao e retorno para login em `src/pages/Login.tsx` e rotas em `src/App.tsx`.
- (x) RF03: criar o fluxo guiado de primeiro acesso com passos persistidos por perfil, cobrindo perfil, programa, baseline do ROI, objetivos e habitos.
- (x) RF04: permitir que o treinador crie e configure a turma antes de adicionar alunos, com programacao, data de inicio, dia de fechamento e duracao do ciclo.
- (x) RF05: implementar convite por e-mail e link unico da turma, com aceite do convite e vinculo em `enrollments`.
- (x) RF06: adicionar onboarding guiado com tooltips na primeira semana e controle de exibicao para nao repetir a experiencia.

Validado em dev:

- `signUp` real com confirmacao de e-mail desativada retornando sessao ativa.
- recovery de senha com `admin.generateLink` + `setSession` + `updateUser`.
- criacao de programa, turma, convite e aceite do convite via Supabase de dev.
- onboarding persistindo `onboarding_completed_at` e a base inicial de programa, ciclo, objetivo, tatica, tarefa, habito e ROI baseline.

Arquivos provaveis: `src/pages/Login.tsx`, `src/pages/Signup.tsx`, `src/context/AuthContext.tsx`, `src/App.tsx`, `src/pages/AdminDashboard.tsx`, `src/lib/supabase.ts`, `SUPABASE_SETUP.sql`.

### M2 - Plano 12 Week Year

- ( ) RF07: limitar a 3 objetivos por ciclo tanto na UI quanto na regra persistida no banco, bloqueando criacao de um quarto objetivo.
- (x) RF08: completar a modelagem e a UX de objetivos, taticas e tarefas para cobrir campos e estados previstos no PRD.
- ( ) RF09: amarrar o check-in de tarefa ao ciclo ativo e ao calendario semanal correto, evitando check-in fora da janela esperada.
- ( ) RF10: calcular e persistir o score semanal oficial no banco no fechamento da semana.
- ( ) RF11: exibir o historico de scores semanais em grafico por ciclo.
- ( ) RF12: exibir o score acumulado do ciclo no perfil e nas visoes resumidas.
- ( ) RF13: arquivar ciclos antigos e permitir consulta do historico sem quebrar o ciclo ativo atual.
- ( ) RF14: montar a visao semanal agrupada por dia, com a lista de tarefas da semana atual organizada por data.

Arquivos provaveis: `src/hooks/useData.ts`, `src/pages/Plan12WY.tsx`, `src/types/index.ts`, `src/pages/Dashboard.tsx`, `SUPABASE_SETUP.sql`.

### M3 - Habitos

- (x) RF15: fechar a modelagem de habitos com tipo, frequencia, meta de dias e regra de pausa.
- (x) RF16: padronizar o check-in diario de habitos com um unico fluxo simples de marcar como cumprido.
- (x) RF17: fechar a regra oficial de streak, incluindo reinicio, pausa e continuidade.
- (x) RF18: implementar o heatmap/calendario estilo GitHub para consistencia do habito.
- (x) RF19: consolidar o comportamento do habito "a abandonar" com check-in invertido.
- (x) RF20: tratar pausa temporaria sem perder historico nem recalcular streak de forma incorreta.
- (x) RF21: adicionar lembrete diario configuravel pelo proprio aluno.

Arquivos provaveis: `src/pages/Habits.tsx`, `src/hooks/useData.ts`, `src/types/index.ts`, `src/pages/Dashboard.tsx`, `public/sw.js`.

### M4 - ROI

- (x) RF22: fechar o onboarding financeiro com baseline, investimento e meta, persistindo tudo no perfil correto.
- (x) RF23: validar o lancamento de resultado financeiro com permissao, formato e relacao com programa/ciclo.
- (x) RF24: completar o dashboard de ROI com total gerado, investimento, saldo e percentual.
- (x) RF25: exibir o grafico de evolucao semanal do total gerado.
- (x) RF26: uniformizar a visibilidade por papel em todas as telas e consultas de ROI.
- (x) RF27: criar o fluxo de meta de ROI negociada entre aluno e treinador.

Arquivos provaveis: `src/pages/ROI.tsx`, `src/hooks/useData.ts`, `src/types/index.ts`, `src/pages/Dashboard.tsx`, `src/pages/AdminDashboard.tsx`, `SUPABASE_SETUP.sql`.

### M5 - Dashboard do Aluno

- (x) RF28: fechar a home do aluno com score da semana, tendencia, streak, ROI acumulado e proximas tarefas.
- (x) RF29: criar o card de "Acao de Hoje" com check-in rapido direto da home.
- (x) RF30: mostrar semanas completadas, semanas restantes e score acumulado do ciclo.
- (x) RF31: adicionar feed de conquistas recentes com badges desbloqueados.
- (x) RF32: fechar atalhos claros para Plano, Habitos, ROI e Turma.

Validado em dev:

- `npm run lint` passou depois da correção em `src/pages/Ranking.tsx`.
- `npm run build` passou.
- `src/App.tsx` agora usa `React.lazy`/`Suspense` nas rotas e `vite.config.ts` divide vendors, sem warning de chunk grande no build.

Arquivos provaveis: `src/pages/Dashboard.tsx`, `src/components/layout/Shell.tsx`, `src/pages/Plan12WY.tsx`, `src/pages/Habits.tsx`, `src/pages/ROI.tsx`, `src/pages/Ranking.tsx`.

### M6 - Dashboard do Treinador

- (x) RF33: criar a visao consolidada por turma com numero de alunos, score medio e percentual em risco.
- (x) RF34: fechar a lista ordenavel de alunos com score, streak e ROI acumulado.
- (x) RF35: abrir o dashboard completo do aluno a partir da lista do treinador.
- (x) RF36: implementar filtros por status, incluindo em risco, acima da meta e todos.
- (x) RF37: adicionar grafico coletivo de scores semanais da turma.
- (x) RF38: implementar exportacao em PDF individual do aluno.
- (x) RF39: implementar exportacao em PDF da turma em formato resumido.
- (x) RF40: evoluir as notas privadas por aluno para um fluxo completo de uso pelo treinador.

Validado em dev:
- TrainerDashboard.tsx criado com lista ordenável, filtros e dashboard detalhado
- AdminDashboard.tsx atualizado com métricas de turma (score médio, % em risco)
- TrainerCharts.tsx criado com gráfico de linhas de scores semanais
- pdfExport.ts criado com funções de exportação individual e da turma
- CoachNotesPanel.tsx criado com CRUD completo, tags e filtros
- jsPDF instalado como dependência
- Build validado com sucesso

Arquivos criados: `src/pages/TrainerDashboard.tsx`, `src/components/TrainerCharts.tsx`, `src/lib/pdfExport.ts`, `src/components/CoachNotesPanel.tsx`, `src/hooks/useTurmaWeeklyScores.ts`.
Arquivos modificados: `src/pages/AdminDashboard.tsx`, `src/types/index.ts`, `src/hooks/useData.ts`, `src/App.tsx`, `src/components/layout/Shell.tsx`.

### M7 - Dashboard do Super Admin

- (x) RF41: montar a visao global de programas, turmas e alunos ativos.
- (x) RF42: adicionar metricas globais da plataforma.
- (x) RF43: permitir gerenciar programas com criar, editar e arquivar.
- (x) RF44: permitir gerenciar turmas com treinador, fechamento semanal e participantes.
- (x) RF45: completar o gerenciamento de usuarios com criar, editar, desativar e atribuir papeis.
- (x) RF46: implementar a gestao de monitores/alunos graduados com limite por monitor.

Validado em dev:

- `npm run lint` passou.
- `npm run build` passou.
- `/admin` ficou restrito a `SUPER_ADMIN`; `TREINADOR` segue no dashboard proprio.
- O fluxo de convite de usuario, desativacao e limite de monitor foi conectado ao hook e ao schema local.

Arquivos provaveis: `src/pages/AdminDashboard.tsx`, `src/context/AuthContext.tsx`, `src/types/index.ts`, `src/lib/supabase.ts`, `SUPABASE_SETUP.sql`.

### M8 - Aluno Graduado

- ( ) RF47: listar os alunos sob responsabilidade do graduado com status de execucao da semana.
- ( ) RF48: disparar alerta automatico quando um aluno atribuido ficar abaixo de 60% por 2 semanas.
- ( ) RF49: criar canal de mensagens por aluno com historico visivel para treinador.
- ( ) RF50: mostrar a visao do dashboard do aluno sem ROI financeiro.
- ( ) RF51: respeitar o limite maximo de alunos por graduado configurado pelo treinador.

Arquivos provaveis: `src/pages/AdminDashboard.tsx`, `src/pages/Dashboard.tsx`, `src/types/index.ts`, `src/hooks/useData.ts`, `SUPABASE_SETUP.sql`.

### M9 - Gamificacao

- ( ) RF52: consolidar streaks de habitos como regra de produto e exibi-los de forma consistente.
- ( ) RF53: manter o ranking real baseado no score semanal medio.
- ( ) RF54: automatizar o desbloqueio de badges por regra e persistir o evento no banco.
- ( ) RF55: criar o feed de conquistas da turma sem expor dados financeiros.
- ( ) RF56: mostrar celebracao de badge dentro do app e notificar o usuario.

Arquivos provaveis: `src/hooks/useData.ts`, `src/pages/Ranking.tsx`, `src/components/BadgesGrid.tsx`, `src/pages/Dashboard.tsx`, `SUPABASE_SETUP.sql`.

### M10 - Notificacoes

- ( ) RF57: implementar lembrete diario de habitos com horario configuravel.
- ( ) RF58: implementar lembrete de fechamento semanal da turma.
- ( ) RF59: implementar alerta de score baixo para treinador e graduado.
- ( ) RF60: implementar celebracao de badge via push e banner interno.
- ( ) RF61: notificar quando o graduado enviar mensagem.
- ( ) RF62: notificar quando o aluno responder ao graduado.
- ( ) RF63: criar preferencias por tipo de notificacao e por canal push/e-mail.

Arquivos provaveis: `public/sw.js`, `public/manifest.webmanifest`, `public/offline.html`, `src/pages/Dashboard.tsx`, `src/pages/AdminDashboard.tsx`, `src/hooks/useData.ts`.

### M11 - Gaps Transversais

- ( ) Fechar LGPD e auditoria de acesso a dados sensiveis.
- ( ) Registrar logs de acesso ao ROI.
- ( ) Definir backup, recuperacao e confiabilidade operacional.
- ( ) Tirar o offline do scaffold e implementar sincronizacao posterior real.
- ( ) Completar o fluxo de push notifications do PWA.
- ( ) Validar performance e limites do PRD com dados reais do banco de dev.

Arquivos provaveis: `public/sw.js`, `public/manifest.webmanifest`, `src/lib/supabase.ts`, `src/context/AuthContext.tsx`, `SUPABASE_SETUP.sql`.

## Validacao Final Obrigatoria

- (x) Rodar `npm run lint` para garantir que os tipos e contratos ainda fecham.
- (x) Rodar `npm run build` para validar a aplicacao inteira antes de testar no banco.
- (x) Restaurar o localhost em `http://127.0.0.1:3000` depois da implementacao.
- (x) Executar smoke test de login, signup, recovery de senha e onboarding com o Supabase de dev carregado via `.env.dev`.
- Nota: houve rate limit de e-mail enquanto a confirmacao ainda estava ativa no projeto, mas a validacao funcional de Auth fechou depois que a confirmacao foi desativada no painel.
- ( ) Executar smoke test do Plano 12WY com ciclo ativo, objetivo, tatica, tarefa e check-in persistindo no banco.
- ( ) Executar smoke test de Habitos e ROI com leitura e escrita reais no Supabase de dev.
- ( ) Validar dashboards de aluno, treinador, super admin e graduado com os papeis corretos.
- ( ) Validar badges, ranking e notificacoes com dados reais do ambiente de dev.
- ( ) Conferir RLS, visibilidade por papel e integridade das tabelas depois de cada fluxo.
- ( ) Somente depois disso marcar a entrega como pronta.
