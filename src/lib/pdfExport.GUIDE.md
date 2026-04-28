# Guia de Implementação - Exportação PDF (RF38-RF39)

## 📋 Visão Geral

Este guia explica como implementar e utilizar as funcionalidades de exportação PDF para alunos (RF38) e turmas (RF39).

## 🚀 Instalação

A dependência já foi instalada:

```bash
npm install jspdf
```

## 📁 Arquivos Criados

1. **`src/lib/pdfExport.ts`** - Serviço principal de exportação PDF
2. **`src/lib/pdfExport.examples.ts`** - Exemplos de uso e integração

## 🎯 RF38 - PDF Individual do Aluno

### O que está incluído:

- ✅ Nome e email do aluno
- ✅ Score semanal atual e tendência
- ✅ Streak de hábitos
- ✅ ROI acumulado (se permitido por papel)
- ✅ Ciclo atual e progresso
- ✅ Objetivos e progresso
- ✅ Gráfico de evolução semanal

### Como usar:

```tsx
import { generateStudentPDF } from '@/lib/pdfExport';

// No seu componente
const handleExportStudent = async () => {
  const studentData = {
    profile: userProfile,
    summary: planSummary,
    weeklyScores: scores,
    habits: studentHabits,
    habitStats: stats,
    roiBaseline: baseline,
    roiResults: results,
    goals: studentGoals,
    activeCycle: cycle,
    enrollment: activeEnrollment,
  };

  await generateStudentPDF(studentData);
};
```

## 🎯 RF39 - PDF da Turma

### O que está incluído:

- ✅ Nome da turma e programa
- ✅ Treinador responsável
- ✅ Lista de alunos com score médio, status e streak
- ✅ Resumo de métricas da turma
- ✅ Gráfico coletivo simplificado

### Como usar:

```tsx
import { generateTurmaPDF } from '@/lib/pdfExport';

// No seu componente
const handleExportTurma = async () => {
  const turmaData = {
    turma: turmaInfo,
    program: programInfo,
    trainer: trainerProfile,
    members: membersList,
    turmaMetrics: calculatedMetrics,
  };

  await generateTurmaPDF(turmaData);
};
```

## 🔧 Integração com Hooks Existentes

### 1. No Dashboard do Aluno (`src/pages/Dashboard.tsx`)

Adicione o botão de exportação:

```tsx
import { generateStudentPDF } from '../lib/pdfExport';
import { Download } from 'lucide-react';

// No componente Dashboard
const { profile } = useAuth();
const { summary, weeklyScores, habits, stats: habitStats, results, baseline, goals, activeCycle, enrollments } = usePlan12WY();
const { results: roiResults, baseline: roiBaseline } = useROI();

const handleExportPDF = async () => {
  if (!profile) return;

  const studentData = {
    profile,
    summary,
    weeklyScores,
    habits: habits.map(h => ({ ...h, checkins: [] })), // Adicionar checkins se disponível
    habitStats,
    roiBaseline,
    roiResults,
    goals,
    activeCycle,
    enrollment: enrollments.find((e: any) => e.status === 'active'),
  };

  await generateStudentPDF(studentData);
};

// No JSX, adicionar botão
<button
  onClick={handleExportPDF}
  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-green text-black"
>
  <Download className="w-4 h-4" />
  Exportar Relatório
</button>
```

### 2. Na Página de Detalhes da Turma (`src/pages/TurmaDetail.tsx`)

Adicione o botão de exportação:

```tsx
import { generateTurmaPDF } from '../lib/pdfExport';
import { Download } from 'lucide-react';

// No componente TurmaDetail
const handleExportTurmaPDF = async () => {
  if (!turma || !program) return;

  // Buscar weekly scores de todos os membros
  const membersWithScores = await Promise.all(
    members.map(async (member) => {
      const { data: scores } = await supabase
        .from('weekly_scores')
        .select('*')
        .eq('aluno_id', member.profile?.id)
        .order('week_number', { ascending: true });

      return {
        ...member,
        weeklyScores: scores || [],
        habitStats: {
          currentStreak: 0, // Calcular se disponível
          avgPerformance: 0, // Calcular se disponível
        },
      };
    })
  );

  // Calcular métricas da turma
  const allScores = membersWithScores.flatMap(m => m.weeklyScores);
  const avgScore = allScores.length > 0
    ? allScores.reduce((acc, s) => acc + (s.score || 0), 0) / allScores.length
    : 0;

  const activeMembers = members.filter(m => m.enrollment.status === 'active').length;
  const atRiskMembers = membersWithScores.filter(m => {
    const latestScore = m.weeklyScores[m.weeklyScores.length - 1];
    return (latestScore?.score || 0) < 70;
  }).length;

  const turmaData = {
    turma,
    program,
    trainer: trainersById[turma.treinador_id || ''] || null,
    members: membersWithScores,
    turmaMetrics: {
      avgScore,
      activeMembers,
      atRiskMembers,
      onTrackMembers: activeMembers - atRiskMembers,
      avgStreak: 0, // Calcular se disponível
    },
  };

  await generateTurmaPDF(turmaData);
};

// No JSX, adicionar botão
<button
  onClick={handleExportTurmaPDF}
  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-green/20 bg-brand-green/10 text-brand-green"
>
  <Download className="w-4 h-4" />
  Exportar Relatório da Turma
</button>
```

## 📊 Estrutura dos Dados

### StudentData Interface

```typescript
interface StudentData {
  profile: Profile;
  summary: PlanSummary;
  weeklyScores: WeeklyScore[];
  habits: (Habit & { checkins: HabitCheckin[] })[];
  habitStats: {
    currentStreak: number;
    avgPerformance: number;
  };
  roiBaseline: ROIBaseline | null;
  roiResults: ROIResult[];
  goals: PlanGoal[];
  activeCycle: Cycle | null;
  enrollment?: Enrollment & { turmas?: Turma & { program?: Program | null } };
}
```

### TurmaData Interface

```typescript
interface TurmaData {
  turma: Turma;
  program: Program | null;
  trainer: Profile | null;
  members: Array<{
    enrollment: Enrollment;
    profile: Profile | null;
    cycle: Cycle | null;
    weeklyScores: WeeklyScore[];
    habitStats: {
      currentStreak: number;
      avgPerformance: number;
    };
  }>;
  turmaMetrics: {
    avgScore: number;
    activeMembers: number;
    atRiskMembers: number;
    onTrackMembers: number;
    avgStreak: number;
  };
}
```

## 🎨 Branding e Personalização

Os PDFs usam as cores do branding Instituto Caminhos do Êxito:

- **Primary (brand-green)**: `rgb(102, 255, 102)`
- **Dark**: `#050505`
- **Border**: `#1a1a1a`

Para personalizar, edite as constantes `COLORS` em `src/lib/pdfExport.ts`.

## 🔒 Controle de Acesso

O PDF do aluno respeita as permissões de visualização de ROI:

- **SUPER_ADMIN**: vê ROI completo
- **TREINADOR**: vê ROI completo
- **PROPRIETARIO_EMPRESA**: vê ROI completo
- **ALUNO/ALUNO_GRADUADO**: vê ROI apenas se permitido

## 📝 Nomes dos Arquivos

Por padrão, os arquivos são salvos com:

- **Aluno**: `relatorio-aluno-{nome}-{data}.pdf`
- **Turma**: `relatorio-turma-{nome}-{data}.pdf`

Você pode especificar um nome personalizado:

```typescript
await generateStudentPDF(studentData, 'meu-relatorio-customizado.pdf');
await generateTurmaPDF(turmaData, 'relatorio-turma-2024-01.pdf');
```

## ⚠️ Notas Importantes

1. **Dados Reais**: Os exemplos usam dados mock. Na implementação real, use os dados retornados pelos seus hooks.
2. **Performance**: Para turmas com muitos membros, considere adicionar loading states.
3. **Erro Handling**: Sempre use try/catch ao chamar as funções de exportação.
4. **Checkins de Hábitos**: Certifique-se de incluir os checkins ao buscar os hábitos para cálculos corretos.

## 🧪 Testando a Implementação

1. **Teste Individual**:
```bash
# No Dashboard, clique no botão de exportação
# Verifique se o PDF é gerado com todos os dados do aluno
```

2. **Teste de Turma**:
```bash
# Na página de detalhes da turma, clique no botão de exportação
# Verifique se o PDF é gerado com todos os membros
```

## 📚 Recursos Adicionais

- [jsPDF Documentation](https://github.com/parallax/jsPDF)
- [date-fns Documentation](https://date-fns.org/)

## 🎉 Próximos Passos

1. Integrar os botões de exportação nas páginas relevantes
2. Testar com dados reais do Supabase
3. Adicionar loading states e error handling
4. Personalizar cores e layout se necessário
5. Adicionar testes unitários se desejar
