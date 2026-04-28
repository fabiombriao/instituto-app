# PRD — Plataforma de Acompanhamento de Desenvolvimento
## Instituto Caminhos do Êxito

**Versão:** 1.0  
**Data:** Abril de 2026  
**Responsáveis:** Fabian & Tatiane (Super Admins)  
**Status:** Em Definição

---

## 1. Visão Geral do Produto

### 1.1 Declaração de Visão

A Plataforma de Acompanhamento de Desenvolvimento do Instituto Caminhos do Êxito é um web app de uso diário que transforma o processo de coaching — antes restrito ao momento presencial da aula — numa experiência contínua, mensurável e motivadora. O aluno registra sua execução diária, monitora seus hábitos, acompanha o crescimento do seu ROI financeiro e visualiza seu progresso dentro de um ciclo estruturado baseado na metodologia 12 Week Year (12WY). Treinadores, Alunos Graduados e gestores de empresas parceiras têm visibilidade em tempo real sobre a performance das suas turmas, podendo intervir antes que a falta de execução comprometa resultados.

### 1.2 Problema que Resolve

Hoje, o acompanhamento entre sessões de coaching depende exclusivamente da autorreflexão do aluno durante a aula — sem registro estruturado, sem dados acumulados e sem visibilidade para o treinador sobre o que está acontecendo na semana do aluno. O app resolve isso criando uma rotina de autogestão diária ancorada em dados reais, gerando engajamento contínuo e evidenciando o ROI do treinamento de forma concreta.

### 1.3 Objetivos do Produto

- Aumentar a taxa de execução semanal dos alunos (meta: média acima de 70% por turma)
- Tornar o ROI do treinamento visível e mensurável para o aluno
- Reduzir a sobrecarga do treinador com dashboards que concentram a informação relevante
- Criar um diferencial competitivo do Instituto frente a outros programas de coaching
- Suportar múltiplos formatos de treinamento (Rota do Êxito, Eu Vencedor, Método MALG) numa única plataforma

---

## 2. Usuários & Papéis

### 2.1 Mapa de Papéis e Permissões

| Papel | Quem é | Acesso |
|---|---|---|
| **Super Admin** | Fabian e Tatiane (proprietários do Instituto) | Total: todos os programas, turmas, alunos, dados financeiros, configurações da plataforma |
| **Treinador** | Coaches do Instituto | Suas turmas: dashboard completo de cada aluno, dados de ROI, métricas de execução |
| **Proprietário de Empresa** | Contratante do Método MALG | Seus colaboradores inscritos: mesmo nível do Treinador, restrito ao seu grupo |
| **Aluno Graduado** | Ex-aluno designado como monitor | Alunos atribuídos: tudo exceto dados financeiros de ROI + canal de mensagens |
| **Aluno** | Participante ativo de um programa | Apenas seus próprios dados |

### 2.2 Personas

**Persona 1 — O Aluno (usuário principal)**
- Empreendedor ou profissional entre 28–50 anos
- Motivado, mas com agenda cheia — o app precisa ser rápido de usar no dia a dia
- Precisa sentir progresso tangível para manter o engajamento
- Quer ver o dinheiro que o treinamento está gerando, não apenas "evolução pessoal"

**Persona 2 — O Treinador**
- Conduz 1–4 turmas simultâneas com 10–30 alunos cada
- Quer saber rapidamente quem está em risco antes da próxima aula
- Usa o dashboard durante a sessão para comentar o progresso de cada aluno

**Persona 3 — O Aluno Graduado (monitor)**
- Orgulhoso de ter concluído o programa e quer contribuir com a comunidade
- Atua como ponto de contato humano entre sessões
- Recebe alertas e age proativamente com alunos em baixa execução

**Persona 4 — O Proprietário de Empresa (MALG)**
- Quer ROI do investimento nos seus líderes
- Acessa o app esporadicamente para verificar a performance geral do grupo

---

## 3. Arquitetura de Informação

### 3.1 Estrutura de Dados Principal

```
PROGRAMA
└── TURMA
    ├── Configurações (dia de fechamento semanal, treinador responsável, monitores)
    └── ALUNO
        ├── Perfil de ROI
        │   ├── Baseline financeiro (faturamento/renda antes do programa)
        │   ├── Investimento no treinamento
        │   └── Lançamentos de resultados (durante o programa)
        │
        ├── Plano 12WY (por ciclo de 12 semanas)
        │   └── Objetivo SMART
        │       └── Táticas
        │           └── Tarefas (check-in diário)
        │
        └── Hábitos
            ├── Hábitos a construir
            └── Hábitos a abandonar
```

### 3.2 Regras de Negócio Críticas

- Um aluno pode estar em múltiplos programas simultaneamente; cada programa tem seu próprio ciclo de Objetivos, Hábitos e ROI (perfis separados)
- O Score Semanal é calculado automaticamente: `tarefas concluídas ÷ tarefas planejadas × 100%`
- O fechamento da semana ocorre no horário configurado por turma (ex: toda segunda às 23h59)
- Score abaixo de 60% por 2 semanas consecutivas dispara alertas para o Aluno Graduado e o Treinador
- Dados financeiros de ROI são visíveis apenas para Treinador e Super Admin (não para Alunos Graduados)
- O Aluno Graduado monitora no máximo o número de alunos definido pelo Treinador

---

## 4. Funcionalidades por Módulo

### Módulo 1 — Autenticação & Onboarding

**Requisitos Funcionais:**

- RF01: Cadastro por e-mail + senha com verificação de e-mail
- RF02: Login com e-mail e senha; recuperação de senha por e-mail
- RF03: Fluxo de primeiro acesso do aluno: perfil → programa → configuração do ROI baseline → criação de Objetivo/Táticas/Tarefas → criação de Hábitos
- RF04: O treinador cria e configura a turma (programa, data de início, dia de fechamento semanal, número de semanas do ciclo) antes de adicionar alunos
- RF05: Convite de alunos por e-mail ou link único da turma
- RF06: Fluxo de onboarding guiado com tooltips explicativos na primeira semana

---

### Módulo 2 — Plano 12 Week Year (Objetivos, Táticas e Tarefas)

**Requisitos Funcionais:**

- RF07: Aluno cria até 3 Objetivos SMART por ciclo de 12 semanas (campos: título, descrição, indicador de resultado, prazo)
- RF08: Cada Objetivo tem N Táticas; cada Tática tem N Tarefas com frequência definida (diária, dias específicos da semana, semanal)
- RF09: Check-in de tarefa: o aluno marca como "Feita" ou "Não feita" a qualquer momento do dia
- RF10: Score Semanal calculado automaticamente ao fechamento da semana (% de tarefas concluídas sobre planejadas)
- RF11: Histórico de scores semanais exibido em gráfico de linha por ciclo
- RF12: Score do ciclo acumulado (média dos 12 scores semanais) visível no perfil do aluno
- RF13: Ao final de um ciclo, o aluno pode criar um novo ciclo; os anteriores ficam arquivados e acessíveis
- RF14: Visão semanal: lista de todas as tarefas da semana atual agrupadas por dia

---

### Módulo 3 — Hábitos

**Requisitos Funcionais:**

- RF15: Aluno cria hábitos com os campos: nome, tipo (construir / abandonar), frequência (diária, dias da semana selecionados, semanal), meta de dias
- RF16: Check-in diário de hábitos: botão simples de marcar como cumprido
- RF17: Streak calculado automaticamente: dias consecutivos com check-in completo
- RF18: Gráfico de calendário heat-map mostrando consistência do hábito ao longo do tempo (estilo GitHub contributions)
- RF19: Hábito "a abandonar": check-in invertido (o aluno marca os dias em que resistiu ao hábito negativo)
- RF20: Hábitos podem ser pausados temporariamente sem perder o histórico
- RF21: Notificação diária de lembrete no horário configurado pelo próprio aluno

---

### Módulo 4 — ROI

**Requisitos Funcionais:**

- RF22: No onboarding, o aluno preenche o baseline: faturamento médio mensal ou renda antes do programa + valor pago pelo treinamento
- RF23: Lançamento de resultado: o aluno registra valores financeiros gerados (campo: valor, data, descrição breve — ex: "Fechamento de contrato com cliente X: R$ 15.000")
- RF24: Dashboard de ROI: total gerado vs. valor investido no treinamento; saldo (gerado - investido); percentual de ROI
- RF25: Gráfico de linha mostrando evolução do total gerado ao longo das semanas do programa
- RF26: Dados de ROI visíveis apenas para o próprio aluno, Treinador e Super Admin
- RF27: Meta de ROI opcional: aluno e treinador definem juntos um valor-alvo de geração até o fim do ciclo; progresso exibido como barra percentual

---

### Módulo 5 — Dashboard do Aluno

**Requisitos Funcionais:**

- RF28: Home com: Score da semana atual (com indicador visual de tendência vs. semana anterior), streak de hábitos do dia, ROI acumulado, próximas tarefas do dia
- RF29: Card de "Ação de Hoje": lista as tarefas do dia atual com check-in rápido direto da home
- RF30: Visão de progresso geral do ciclo: semanas completadas, semanas restantes, score acumulado
- RF31: Feed de conquistas pessoais (badges desbloqueados recentemente)
- RF32: Acesso rápido a todas as 4 seções principais: Plano, Hábitos, ROI, Turma

---

### Módulo 6 — Dashboard do Treinador

**Requisitos Funcionais:**

- RF33: Visão geral de todas as turmas do treinador: número de alunos, score médio da semana, % de alunos em risco (score < 60%)
- RF34: Lista de alunos da turma com: nome, foto, score da semana atual, streak de hábitos, ROI acumulado — ordenável por qualquer coluna
- RF35: Clique em um aluno abre o dashboard completo daquele aluno (mesma visão que o aluno tem, mais os dados de ROI)
- RF36: Filtro de alunos por status: em risco, acima da meta, todos
- RF37: Histórico de scores semanais de toda a turma em gráfico de área (visão coletiva)
- RF38: Exportação em PDF: relatório individual do aluno (foto, scores, hábitos, ROI, objetivo) formatado para uso em sessão
- RF39: Exportação em PDF: relatório da turma (todos os alunos em formato resumido)
- RF40: Canal de anotações privadas por aluno (notas do treinador, não visíveis ao aluno)

---

### Módulo 7 — Dashboard do Super Admin

**Requisitos Funcionais:**

- RF41: Visão geral de todos os programas, turmas e alunos ativos
- RF42: Métricas globais: total de alunos ativos, score médio da plataforma, ROI total gerado (soma de todos os lançamentos), taxa de engajamento (% com check-in nos últimos 7 dias)
- RF43: Gerenciamento de programas: criar, editar e arquivar programas
- RF44: Gerenciamento de turmas: criar turmas, definir treinador responsável, configurar dia de fechamento semanal, adicionar/remover alunos
- RF45: Gerenciamento de usuários: criar, editar e desativar qualquer usuário; atribuir papéis
- RF46: Gerenciamento de Alunos Graduados: atribuir monitores a alunos específicos dentro de uma turma, definir limite de alunos por monitor

---

### Módulo 8 — Aluno Graduado (Monitor)

**Requisitos Funcionais:**

- RF47: Lista dos alunos sob sua responsabilidade com status de execução da semana
- RF48: Alerta automático (push + e-mail) quando um aluno atribuído fica abaixo de 60% por 2 semanas consecutivas
- RF49: Canal de mensagens por aluno: o Graduado escreve uma mensagem/comentário no perfil do aluno; o aluno responde; o Treinador vê o histórico completo
- RF50: Visualização completa do dashboard do aluno (exceto dados de ROI financeiro)
- RF51: Limite máximo de alunos por Graduado configurado pelo Treinador

---

### Módulo 9 — Gamificação

**Requisitos Funcionais:**

- RF52: Streaks de hábitos: contagem de dias consecutivos com check-in completo; exibição proeminente na home
- RF53: Ranking da turma: baseado no score semanal médio; não expõe dados financeiros
- RF54: Badges — lista completa:

| Badge | Critério |
|---|---|
| Primeiro Passo | Completar o onboarding e criar o primeiro objetivo |
| Semana Perfeita | Score semanal de 100% |
| Consistência de Aço | Semana com 85%+ por 4 semanas consecutivas |
| Hábito Fundado | 21 dias consecutivos de check-in em um hábito |
| Hábito Enraizado | 66 dias consecutivos de check-in em um hábito |
| Primeira Conquista | Primeiro lançamento de resultado de ROI |
| Dobrei o Investimento | ROI acumulado ≥ 2× o valor pago pelo treinamento |
| Mentor Ativo | Aluno Graduado que enviou mensagem para todos os seus monitorados na semana |
| Ciclo Completo | Concluir as 12 semanas com score acumulado acima de 70% |

- RF55: Feed de conquistas da turma: quando um aluno desbloqueia um badge relevante, aparece no feed coletivo (sem expor dados financeiros)
- RF56: Notificação de desbloqueio de badge: push + banner celebratório dentro do app

---

### Módulo 10 — Notificações

**Requisitos Funcionais:**

- RF57: Lembrete diário de check-in de hábitos (horário configurado pelo aluno nas preferências)
- RF58: Lembrete de fechamento semanal: notificação no dia anterior ao fechamento da turma alertando sobre tarefas pendentes
- RF59: Alerta de score baixo: para Treinador e Aluno Graduado quando aluno fica abaixo de 60% por 2 semanas consecutivas
- RF60: Celebração de badge: notificação push ao desbloquear conquista
- RF61: Mensagem do Graduado: notificação quando o monitor deixa uma mensagem
- RF62: Resposta de mensagem: notificação quando o aluno responde ao monitor
- RF63: Canais: push (web notifications) + e-mail; cada tipo de notificação configurável individualmente pelo usuário

---

## 5. Fluxos Principais

### Fluxo 1 — Dia Típico do Aluno

```
Acorda → Notificação de check-in (horário configurado)
→ Abre o app → Home mostra tarefas do dia
→ Marca tarefas como feitas conforme executa durante o dia
→ Faz check-in dos hábitos do dia
→ (Se aplicável) Registra um resultado financeiro em ROI
→ Vê score parcial da semana atualizado em tempo real
→ Recebe badge se desbloqueou conquista
```

### Fluxo 2 — Fechamento Semanal

```
Dia anterior ao fechamento → Notificação de tarefas pendentes
→ Aluno revisa e faz check-ins finais
→ Horário de fechamento → Score semanal calculado automaticamente
→ Score registrado no histórico
→ Se < 60% por 2ª semana consecutiva → Alerta para Graduado e Treinador
→ Ranking da turma atualizado
```

### Fluxo 3 — Aula Semanal (visão do Treinador)

```
Treinador abre o app antes da aula
→ Dashboard da turma mostra score médio da semana e alunos em risco
→ Clica em aluno específico → Abre dashboard completo
→ Durante a aula, usa os dados para orientar o feedback individual
→ Registra anotações privadas no perfil do aluno
→ (Opcional) Gera PDF do relatório da turma para uso na sessão
```

### Fluxo 4 — Onboarding de Nova Turma

```
Super Admin cria o Programa → Cria a Turma com configurações (treinador, dia de fechamento, número de semanas)
→ Sistema gera link de convite
→ Treinador compartilha o link com alunos (WhatsApp/e-mail)
→ Aluno clica no link → Cadastra-se → Vinculado automaticamente à turma
→ Fluxo de onboarding guiado: perfil → ROI baseline → Objetivo SMART → Táticas → Tarefas → Hábitos
→ Treinador recebe notificação de novo aluno na turma
→ Treinador pode atribuir um Aluno Graduado como monitor
```

---

## 6. Requisitos Não-Funcionais

### 6.1 Plataforma

- Web app responsivo (mobile-first), com experiência otimizada para smartphone
- Compatibilidade: Chrome, Safari, Edge (versões dos últimos 2 anos)
- O aluno usa majoritariamente pelo celular; o treinador pode usar pelo desktop
- Progressive Web App (PWA) para permitir instalação na tela inicial e notificações push sem loja de apps

### 6.2 Performance

- Carregamento inicial (LCP): < 2,5 segundos em 4G
- Check-in de tarefa/hábito: resposta < 500ms (sensação de instantâneo)
- Dashboard com até 50 alunos carregado em < 3 segundos

### 6.3 Segurança & Privacidade

- Autenticação com tokens JWT com expiração configurável
- Dados financeiros (ROI) armazenados com controle de acesso em nível de registro
- HTTPS obrigatório em todos os endpoints
- Logs de acesso a dados sensíveis (quem acessou o ROI de qual aluno, quando)
- Conformidade com LGPD: política de privacidade, direito de exclusão de dados, consentimento explícito no cadastro

### 6.4 Confiabilidade

- Disponibilidade: 99,5% uptime (máximo ~3,6h de downtime/mês)
- Backup automático diário dos dados
- Check-ins salvos localmente (offline) e sincronizados quando a conexão retornar

---

## 7. Arquitetura Técnica Sugerida

> Esta seção é uma recomendação de direção tecnológica para orientar o time de desenvolvimento. Pode ser revisada conforme stack e expertise do time escolhido.

### 7.1 Stack Recomendado

| Camada | Tecnologia Sugerida | Justificativa |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS | Renderização híbrida, SEO, PWA nativo, ecossistema maduro |
| Backend | Node.js + NestJS | Tipagem forte, módulos bem definidos, fácil escalar |
| Banco de dados | PostgreSQL | Relacional, ideal para hierarquia programa→turma→aluno |
| Autenticação | NextAuth.js ou Auth0 | Segurança robusta sem reinventar a roda |
| Notificações Push | Web Push API + serviço SMTP (Resend ou SendGrid) | Push nativo no browser, e-mail transacional |
| Hospedagem | Vercel (frontend) + Railway ou Render (backend) | Deploy simples, escalável, custo controlado no início |
| Armazenamento de arquivos | Cloudflare R2 ou AWS S3 | PDFs exportados, fotos de perfil |

### 7.2 Integrações Futuras (fora do MVP)

- Calendário Google / Outlook (agendamento de sessões)
- WhatsApp Business API (notificações via WhatsApp além do push/e-mail)
- Stripe ou Pagar.me (cobrança de acesso ao app como módulo do pacote de treinamento)

---

## 8. Roadmap de Versões

### MVP (Versão 0.1) — 8–10 semanas de desenvolvimento

Objetivo: validar o ciclo core com uma turma piloto do Rota do Êxito.

**Incluído no MVP:**
- Autenticação e onboarding básico
- Criação de Objetivo + Táticas + Tarefas (1 objetivo por ciclo)
- Check-in diário de tarefas
- Score semanal automático com fechamento manual pelo treinador
- Hábitos (construir e abandonar) com check-in diário e streak
- Dashboard básico do aluno (home + progresso semanal)
- Dashboard básico do treinador (lista de alunos + score semanal de cada um)
- Notificações por e-mail (lembrete diário + alerta de score baixo)
- Suporte a 1 programa e N turmas

**Fora do MVP:**
- ROI (Versão 0.2)
- Gamificação completa (Versão 0.2)
- Aluno Graduado (Versão 0.2)
- Exportação de PDF (Versão 0.3)
- Proprietário de empresa / MALG (Versão 0.3)
- Push notifications / PWA (Versão 0.3)
- Super Admin completo (Versão 0.3)

### Versão 0.2 — +6 semanas após MVP

- Módulo de ROI completo (baseline, lançamentos, dashboard financeiro)
- Gamificação: badges, streaks visuais, ranking da turma
- Papel do Aluno Graduado: canal de mensagens + alertas
- Notificações push (PWA instalável)
- Suporte a múltiplos objetivos por ciclo (até 3)

### Versão 0.3 — +6 semanas após V0.2

- Super Admin completo (gestão de programas, turmas, usuários)
- Exportação de relatórios em PDF (individual e da turma)
- Papel do Proprietário de Empresa (MALG)
- Ciclos arquivados: histórico de ciclos anteriores do aluno
- Onboarding guiado com tooltips interativos

### Versão 1.0 — Produto completo

- Todos os módulos acima consolidados e estabilizados
- Refinamentos de UX baseados no feedback das turmas piloto
- Internacionalização (pt-BR como padrão; estrutura preparada para EN e ES)
- Documentação de uso para treinadores e alunos

---

## 9. Métricas de Sucesso

| Métrica | Meta (3 meses após lançamento) |
|---|---|
| Taxa de check-in diário | ≥ 60% dos alunos ativos fazem check-in em ≥ 5 dias/semana |
| Score médio por turma | ≥ 65% de execução semanal |
| Retenção semanal | ≥ 80% dos alunos abrem o app ao menos 1x por semana |
| ROI total registrado | ≥ 3× o valor total investido pelos alunos (soma de lançamentos) |
| NPS do app | ≥ 8,0 (em pesquisa pós-ciclo de 12 semanas) |

---

## 10. Questões em Aberto

As questões abaixo não foram definidas nesta versão do PRD e devem ser resolvidas antes ou durante o desenvolvimento do MVP:

| # | Questão | Impacto |
|---|---|---|
| Q1 | O acesso ao app é incluído no preço do treinamento ou cobrado separadamente? | Define modelo de licenciamento e multitenancy futuro |
| Q2 | Como é feita a migração dos alunos atuais (150 ativos)? Importação em massa ou cadastro individual? | Afeta o onboarding inicial da plataforma |
| Q3 | O aluno pode criar hábitos fora de um programa ativo (uso autônomo)? | Afeta escopo e complexidade do módulo de hábitos |
| Q4 | Ao final do ciclo de 12 semanas, o acesso ao app expira ou permanece para consulta histórica? | Afeta retenção e modelo de dados |
| Q5 | O Treinador pode editar ou excluir os objetivos/tarefas criados pelo aluno? | Afeta permissões e fluxo de revisão em aula |
| Q6 | Há necessidade de um chat geral da turma (grupo), além do canal individual Graduado→Aluno? | Aumenta significativamente o escopo de comunicação |

---

*Documento elaborado em colaboração entre a equipe do Instituto Caminhos do Êxito e Perplexity AI — Abril de 2026.*
