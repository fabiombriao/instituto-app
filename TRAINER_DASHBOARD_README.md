# Dashboard do Treinador - Guia de Uso

## Visão Geral

O Dashboard do Treinador é uma nova funcionalidade que permite SUPER_ADMIN e TREINADORES acompanharem a performance dos alunos de forma visual e organizada, implementando os requisitos RF34-RF36.

## Funcionalidades Implementadas

### RF34: Lista Ordenável de Alunos

- **Colunas disponíveis:**
  - **Nome:** Nome do aluno com avatar e ciclo atual
  - **Score Semanal:** Percentual de conclusão de tarefas da semana atual
  - **Streak:** Número de dias consecutivos com hábitos concluídos
  - **ROI Acumulado:** Valor total de resultados financeiros registrados

- **Ordenação:**
  - Clique em qualquer coluna para ordenar
  - Clique novamente para inverter a ordem (crescente/decrescente)
  - Indicadores visuais mostram a coluna ativa e a direção da ordenação

### RF35: Dashboard do Aluno

- **Acesso:** Clique no botão "Ver Dashboard" ou em qualquer linha da tabela
- **Modal com informações detalhadas:**
  - Cards resumidos de Score, Streak e ROI
  - Evolução semanal completa (mini-gráficos de scores)
  - Lista de hábitos ativos com streaks individuais
  - Resultados de ROI recentes (últimos 5 registros)
  - Informações do ciclo atual

### RF36: Filtros por Status

- **Filtros disponíveis:**
  - **Todos:** Mostra todos os alunos (padrão)
  - **Em Risco:** Alunos com score < 60% (destaque em vermelho)
  - **Acima da Meta:** Alunos com score >= 80% (destaque em verde)

- **Indicadores visuais:**
  - Badges coloridas mostram o status de cada aluno
  - Ícones indicam tendências (TrendingDown para risco, TrendingUp para acima da meta)
  - Cores dinâmicas nos scores baseadas no desempenho

## Como Acessar

### Via Sidebar
1. Faça login como SUPER_ADMIN ou TREINADOR
2. No menu lateral, clique em "01. DASHBOARD TREINADOR"

### Via AdminDashboard
1. Acesse o AdminDashboard (/admin)
2. Clique no botão "Dashboard do Treinador" no topo da página

### Diretamente pela URL
Navegue para: `/trainer-dashboard`

## Uso Prático

### Busca de Alunos
1. Use a barra de busca no topo
2. Digite nome ou email do aluno
3. A lista é filtrada em tempo real

### Ordenação
1. Clique no cabeçalho da coluna desejada
2. Primeiro clique: ordem decrescente (maior para menor)
3. Segundo clique: ordem crescente (menor para maior)

### Filtros de Status
1. Clique no botão de filtro desejado
2. A lista é atualizada instantaneamente
3. Filtros são cumulativos com a busca

### Visualização Detalhada
1. Clique em qualquer linha da tabela ou no botão "Ver Dashboard"
2. O modal mostra todas as métricas do aluno
3. Role para ver histórico de scores, hábitos e ROI
4. Clique em "Fechar detalhes" para voltar

## Dados Exibidos

### Fontes de Dados
- **Profiles:** Informações básicas do aluno
- **Enrollments:** Vínculos com turmas (status: active)
- **Cycles:** Ciclos ativos dos alunos
- **Weekly Scores:** Scores semanais calculados
- **Habits:** Hábitos ativos (is_paused: false)
- **Habit Checkins:** Histórico de check-ins para cálculo de streak
- **ROI Results:** Resultados financeiros registrados

### Cálculos Automáticos
- **Score Semanal:** Último registro em weekly_scores
- **Streak Atual:** Maior sequência de dias entre todos os hábitos ativos
- **ROI Acumulado:** Soma de todos os roi_results do aluno
- **Status:** Baseado no score (risco < 60%, meta >= 80%)

## Estilos e Visual

### Design System
- Cores do tema escuro (#050505, #0a0a0a)
- brand-green para ações e destaques
- Cores semânticas (verde para sucesso, vermelho para risco, azul para neutro)
- Animações suaves com Framer Motion
- Responsive design (mobile-first)

### Badges e Indicadores
- **Em Risco:** Fundo rose-500/10, borda rose-500/30
- **Acima da Meta:** Fundo emerald-500/10, borda emerald-500/30
- **No Ritmo:** Fundo blue-500/10, borda blue-500/30

## Considerações Técnicas

### Performance
- Busca otimizada com useMemo
- Ordenação client-side para resposta instantânea
- Lazy loading de dados detalhados do modal
- Timeout de loading para travamentos

### Segurança
- Verificação de role antes de acessar
- Redirect para / se não autorizado
- Dados filtrados por aluno_id

## Arquivos Modificados

### Criados
- `/src/pages/TrainerDashboard.tsx` - Componente principal

### Modificados
- `/src/App.tsx` - Adicionada rota `/trainer-dashboard`
- `/src/components/layout/Shell.tsx` - Adicionado link na sidebar
- `/src/pages/AdminDashboard.tsx` - Adicionado botão de acesso rápido

## Próximas Melhorias Possíveis

- [ ] Exportar lista para CSV/Excel
- [ ] Gráficos de evolução temporal
- [ ] Comparação entre alunos
- [ ] Filtros por turma/programa
- [ ] Notificações para alunos em risco
- [ ] Anotações rápidas no modal
- [ ] Histórico completo de scores em gráfico

## Suporte

Para dúvidas ou problemas, consulte a equipe de desenvolvimento ou verifique os logs do console para erros específicos.
