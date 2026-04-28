# RF37: Exemplo Visual da Estrutura do Gráfico

## Layout do Componente TrainerCharts

```
┌─────────────────────────────────────────────────────────────────┐
│  Evolução Semanal da Turma                        [TrendingUp]  │
│  Scores semanais por aluno e média da turma                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  100% │        ┌──── Média da Turma (linha branca tracejada)  │
│       │       ╱                                                │
│   80% │     ╱ ╲  Aluno 1 (verde)                              │
│       │   ╱     ╲                                             │
│   60% │ ╱         ╲  Aluno 2 (azul)                           │
│       │╱            ╲                                         │
│   40% │              ╲                                        │
│       │               ╲  Aluno 3 (amarelo)                     │
│   20% │                ╲                                      │
│       │                 ╲                                     │
│    0% └────────────────────────────────────────────────────  │
│       S1  S2  S3  S4  S5  S6  S7  S8  S9  S10 S11 S12        │
│                                                                 │
│  Legenda:                                                       │
│  ━━ Média da Turma    ● Aluno 1    ● Aluno 2    ● Aluno 3     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬────────────────┐
│ Total Alunos │ Média Atual  │ Semanas Reg.   │
│      8       │     72%      │       12        │
└──────────────┴──────────────┴────────────────┘
```

## Fluxo de Dados

```
useTurmaWeeklyScores(turmaId)
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Busca ciclos ativos da turma                             │
│    SELECT * FROM cycles WHERE turma_id = ? AND status='active'│
├─────────────────────────────────────────────────────────────┤
│ 2. Busca perfis dos alunos                                  │
│    SELECT * FROM profiles WHERE id IN (aluno_ids)           │
├─────────────────────────────────────────────────────────────┤
│ 3. Busca weekly_scores                                     │
│    SELECT * FROM weekly_scores WHERE cycle_id IN (cycle_ids)│
├─────────────────────────────────────────────────────────────┤
│ 4. Agrupa dados por aluno                                   │
│    Map<alunoId, { profile, scores[] }>                     │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ TrainerCharts Component                                      │
├─────────────────────────────────────────────────────────────┤
│ • Processa dados com useMemo                                │
│ • Calcula médias por semana                                │
│ • Gera paleta de cores                                     │
│ • Prepara estrutura para o gráfico                         │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Recharts LineChart                                          │
├─────────────────────────────────────────────────────────────┤
│ • Linha tracejada grossa = Média da Turma                  │
│ • Linhas finhas coloridas = Alunos individuais            │
│ • Tooltip customizado ao passar o mouse                   │
│ • Legenda com nomes truncados                             │
└─────────────────────────────────────────────────────────────┘
```

## Paleta de Cores

```
1. emerald-500  (#10b981) - Verde vibrante
2. blue-500     (#3b82f6) - Azul primário
3. amber-500    (#f59e0b) - Amarelo/laranja
4. violet-500   (#8b5cf6) - Roxo médio
5. pink-500     (#ec4899) - Rosa vibrante
6. teal-500     (#14b8a6) - Verde azulado
7. orange-500   (#f97316) - Laranja forte
8. indigo-500   (#6366f1) - Índigo
9. lime-500     (#84cc16) - Lima
10. cyan-500    (#06b6d4) - Ciano
11. yellow-500  (#eab308) - Amarelo
12. fuchsia-500 (#d946ef) - Fúcsia

Média da Turma: #ffffff (branco, tracejado, grossa)
```

## Estados do Componente

### Estado: Loading
```
┌─────────────────────────────────────────┐
│         [Spinner animado]               │
│  Carregando dados da turma...           │
└─────────────────────────────────────────┘
```

### Estado: Error
```
┌─────────────────────────────────────────┐
│  Erro ao carregar dados                 │
│  Mensagem de erro específica           │
└─────────────────────────────────────────┘
```

### Estado: Empty (sem turma selecionada)
```
┌─────────────────────────────────────────┐
│         [TrendingUp icon]               │
│  Selecione uma turma para visualizar    │
│  os gráficos                            │
└─────────────────────────────────────────┘
```

### Estado: Empty (sem dados)
```
┌─────────────────────────────────────────┐
│         [TrendingUp icon]               │
│  Nenhum dado de score semanal           │
│  disponível para esta turma             │
└─────────────────────────────────────────┘
```

### Estado: Success
```
┌─────────────────────────────────────────┐
│  [Gráfico completo com todas as linhas] │
│  [Cards de estatísticas]                │
└─────────────────────────────────────────┘
```

## Exemplo de Uso no Dashboard

```
AdminDashboard
│
├─ Stats Section
│  ├─ Alunos: 8
│  ├─ Treinadores: 2
│  └─ ...
│
├─ Programs Section
│  └─ Lista de programas
│
├─ Turmas Section
│  ├─ [Turma A] [x] selecionada
│  ├─ [Turma B]
│  └─ [Turma C]
│
├─ ─────────────────────────────────────
│
├─ Performance Charts Section  ← NOVA SEÇÃO
│  │
│  ├─ [Mostrar Gráficos] button
│  │
│  └─ (quando clicado)
│     │
│     ├─ TrainerCharts Component
│     │  ├─ LineChart (12 semanas)
│     │  ├─ Tooltip customizado
│     │  └─ Legend colorida
│     │
│     └─ Stats Cards
│        ├─ Total Alunos: 8
│        ├─ Média Atual: 72%
│        └─ Semanas Registradas: 12
│
├─ Users Management Section
│  └─ Tabela de usuários
│
└─ User Detail Modal
   └─ Notas privadas
```

## Fluxo de Interação do Usuário

```
1. Usuário acessa AdminDashboard
   ↓
2. Vê lista de turmas na seção "Turmas"
   ↓
3. Clica em uma turma (ex: "Turma A")
   ↓
4. Turma fica destacada em verde
   ↓
5. Aparece nova seção "Análise de Performance"
   ↓
6. Clica em "Mostrar Gráficos"
   ↓
7. Gráfico carrega com animação suave
   ↓
8. Usuário passa o mouse sobre o gráfico
   ↓
9. Tooltip mostra detalhes da semana
   ↓
10. Usuário pode analisar:
    - Linha branca = performance média da turma
    - Linhas coloridas = performance individual
    - Identificar alunos acima/abaixo da média
    - Ver tendências ao longo das 12 semanas
```

## Tipagem TypeScript

```typescript
// Hook
interface TurmaWeeklyScoreData {
  alunoId: string;
  profile: Profile | null;
  scores: WeeklyScore[];
}

interface WeeklyScore {
  id: string;
  aluno_id: string;
  cycle_id: string;
  week_number: number;
  score: number;
  week_start?: string | null;
  week_end?: string | null;
  created_at: string;
}

// Component Props
interface TrainerChartsProps {
  turmaId: string | null;
  className?: string;
}

// Dados do Gráfico
interface ChartDataPoint {
  week: string;           // "S1", "S2", etc.
  weekNumber: number;     // 1, 2, 3, etc.
  [key: string]: string | number | null;
  // student_{alunoId}: number | null
  // average: number | null
}
```

## Responsividade

```
Desktop (>= 1024px):
┌─────────────────────────────────────────────────────────────┐
│                    Gráfico Completo                         │
│                    3 cards em linha                         │
└─────────────────────────────────────────────────────────────┘

Tablet (768px - 1023px):
┌─────────────────────────────────────────────────────────────┐
│                    Gráfico Completo                         │
│                    3 cards em linha                         │
└─────────────────────────────────────────────────────────────┘

Mobile (< 768px):
┌─────────────────────────┐
│   Gráfico Reduzido      │
│   Scroll horizontal     │
├─────────────────────────┤
│   Card 1                │
├─────────────────────────┤
│   Card 2                │
├─────────────────────────┤
│   Card 3                │
└─────────────────────────┘
```

## Próximos Passos para Melhorias

1. **Filtros Avançados**
   - [ ] Selecionar range de semanas
   - [ ] Filtrar alunos específicos
   - [ ] Comparar com turmas anteriores

2. **Exportação**
   - [ ] Exportar como PNG
   - [ ] Exportar dados como CSV
   - [ ] Gerar relatório PDF

3. **Interações**
   - [ ] Zoom em períodos
   - [ ] Highlight de linha ao clicar
   - [ ] Mostrar tendência linear

4. **Métricas**
   - [ ] Ranking de alunos
   - [ ] Alertas de risco
   - [ ] Comparativo com ciclo anterior
