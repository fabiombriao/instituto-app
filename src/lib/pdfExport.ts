import jsPDF from 'jspdf';
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  Profile,
  PlanSummary,
  WeeklyScore,
  Habit,
  HabitCheckin,
  ROIBaseline,
  ROIResult,
  PlanGoal,
  Cycle,
  Enrollment,
  Turma,
  Program,
} from '../types';

// Cores do branding Instituto Caminhos do Êxito
const COLORS = {
  primary: [102, 255, 102], // brand-green RGB
  dark: [5, 5, 5], // #050505 RGB
  border: [26, 26, 26], // #1a1a1a RGB
  white: [255, 255, 255],
  gray: [128, 128, 128],
  success: [16, 185, 129], // emerald-500 RGB
  warning: [245, 158, 11], // amber-500 RGB
  danger: [239, 68, 68], // rose-500 RGB
};

// Helper para converter cores RGB para string hex
function rgbToHex(rgb: number[]): string {
  return '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Helper para formatar moeda
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

// Helper para adicionar cabeçalho do documento
function addDocumentHeader(pdf: jsPDF, title: string, subtitle: string) {
  // Background escuro
  pdf.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), 45, 'F');

  // Header com gradiente (simplificado)
  pdf.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), 3, 'F');

  // Título principal
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  pdf.text(title, 20, 20);

  // Subtítulo
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  pdf.text(subtitle, 20, 30);

  // Linha decorativa
  pdf.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.setLineWidth(0.5);
  pdf.line(20, 38, pdf.internal.pageSize.getWidth() - 20, 38);

  // Logo/Branding
  pdf.setFontSize(8);
  pdf.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.text('INSTITUTO CAMINHOS DO ÊXITO', pdf.internal.pageSize.getWidth() - 20, 20, { align: 'right' });
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  pdf.text(format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), pdf.internal.pageSize.getWidth() - 20, 28, { align: 'right' });

  return 50; // Retorna posição Y para conteúdo
}

// Helper para adicionar seção
function addSection(pdf: jsPDF, y: number, title: string): number {
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.text(title.toUpperCase(), 20, y);

  pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  pdf.setLineWidth(0.3);
  pdf.line(20, y + 3, pdf.internal.pageSize.getWidth() - 20, y + 3);

  return y + 12;
}

// Helper para adicionar card de métrica
function addMetricCard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  subtitle?: string,
  color: number[] = COLORS.white
): number {
  // Background do card
  pdf.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(x, y, width, 35, 3, 3, 'FD');

  // Label
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  pdf.text(label.toUpperCase(), x + 5, y + 8);

  // Valor
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(color[0], color[1], color[2]);
  pdf.text(value, x + 5, y + 18);

  // Subtítulo (se houver)
  if (subtitle) {
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
    const lines = pdf.splitTextToSize(subtitle, width - 10);
    pdf.text(lines, x + 5, y + 26);
  }

  return y + 40;
}

// Helper para adicionar gráfico de barras simplificado
function addBarChart(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  data: { label: string; value: number; color?: number[] }[],
  title: string
): number {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  pdf.text(title.toUpperCase(), x, y - 5);

  // Background
  pdf.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  pdf.roundedRect(x, y, width, height, 3, 3, 'FD');

  const barHeight = 12;
  const barSpacing = 4;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  data.forEach((item, index) => {
    const barY = y + 8 + (barHeight + barSpacing) * index;
    const barWidth = ((width - 80) * item.value) / maxValue;

    // Label
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
    pdf.text(item.label, x + 5, barY + 8);

    // Bar background
    pdf.setFillColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    pdf.roundedRect(x + 55, barY, width - 60, barHeight, 2, 2, 'F');

    // Bar value
    const barColor = item.color || COLORS.primary;
    pdf.setFillColor(barColor[0], barColor[1], barColor[2]);
    pdf.roundedRect(x + 55, barY, Math.max(barWidth, 2), barHeight, 2, 2, 'F');

    // Value text
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    pdf.text(`${item.value}%`, x + width - 5, barY + 8, { align: 'right' });
  });

  return y + height + 10;
}

// Helper para adicionar lista de itens
function addItemList(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  items: { title: string; description?: string; status?: string; progress?: number }[],
  title: string
): number {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  pdf.text(title.toUpperCase(), x, y);

  pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  pdf.setLineWidth(0.3);
  pdf.line(x, y + 3, x + width, y + 3);

  let currentY = y + 10;
  const itemHeight = 25;

  items.forEach((item) => {
    // Card background
    pdf.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(x, currentY, width, itemHeight, 2, 2, 'FD');

    // Title
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    pdf.text(item.title.substring(0, 50) + (item.title.length > 50 ? '...' : ''), x + 5, currentY + 8);

    // Description
    if (item.description) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
      const lines = pdf.splitTextToSize(item.description, width - 70);
      pdf.text(lines.slice(0, 2), x + 5, currentY + 15);
    }

    // Progress/Status
    if (item.progress !== undefined) {
      // Progress bar
      pdf.setFillColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
      pdf.roundedRect(x + width - 45, currentY + 10, 35, 4, 1, 1, 'F');
      pdf.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
      pdf.roundedRect(x + width - 45, currentY + 10, (35 * item.progress) / 100, 4, 1, 1, 'F');

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
      pdf.text(`${item.progress}%`, x + width - 5, currentY + 8, { align: 'right' });
    } else if (item.status) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
      pdf.text(item.status, x + width - 5, currentY + 13, { align: 'right' });
    }

    currentY += itemHeight + 5;
  });

  return currentY + 5;
}

/**
 * RF38: Gera PDF individual do aluno
 * @param studentData - Dados do aluno
 * @param filename - Nome do arquivo (opcional)
 * @returns Promise<void>
 */
export async function generateStudentPDF(
  studentData: {
    profile: Profile;
    summary: PlanSummary;
    weeklyScores: WeeklyScore[];
    habits: (Habit & { checkins: HabitCheckin[] })[];
    habitStats: { currentStreak: number; avgPerformance: number };
    roiBaseline: ROIBaseline | null;
    roiResults: ROIResult[];
    goals: PlanGoal[];
    activeCycle: Cycle | null;
    enrollment?: Enrollment & { turmas?: Turma & { program?: Program | null } };
  },
  filename?: string
): Promise<void> {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = 0;

  const {
    profile,
    summary,
    weeklyScores,
    habits,
    habitStats,
    roiBaseline,
    roiResults,
    goals,
    activeCycle,
    enrollment,
  } = studentData;

  // Cabeçalho do documento
  yPosition = addDocumentHeader(
    pdf,
    'Relatório Individual do Aluno',
    `Análise completa de desempenho e progresso`
  );

  // Informações do aluno
  yPosition = addSection(pdf, yPosition, 'Informações do Aluno');

  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  pdf.text(`Nome: ${profile.full_name || 'N/A'}`, margin, yPosition);
  pdf.text(`Email: ${profile.email || 'N/A'}`, margin, yPosition + 8);
  pdf.text(
    `Turma: ${enrollment?.turmas?.name || 'Não vinculado'}`,
    margin,
    yPosition + 16
  );

  yPosition += 30;

  // Métricas principais
  yPosition = addSection(pdf, yPosition, 'Métricas de Desempenho');

  const currentWeeklyScore =
    weeklyScores.length > 0
      ? weeklyScores[weeklyScores.length - 1]?.score ?? summary.weeklyScore
      : summary.weeklyScore;
  const previousWeeklyScore =
    weeklyScores.length > 1 ? weeklyScores[weeklyScores.length - 2]?.score ?? null : null;
  const weeklyTrendDelta =
    previousWeeklyScore === null ? null : currentWeeklyScore - previousWeeklyScore;

  const cardWidth = (pageWidth - 2 * margin - 10) / 3;

  // Score Semanal
  yPosition = addMetricCard(
    pdf,
    margin,
    yPosition,
    cardWidth,
    'Score Semanal',
    `${currentWeeklyScore}%`,
    activeCycle
      ? `Semana ${summary.currentWeek}/${summary.totalWeeks}`
      : 'Sem ciclo ativo',
    weeklyTrendDelta === null
      ? COLORS.white
      : weeklyTrendDelta >= 0
      ? COLORS.success
      : COLORS.danger
  );

  // Tendência
  yPosition = addMetricCard(
    pdf,
    margin + cardWidth + 5,
    yPosition - 40,
    cardWidth,
    'Tendência',
    weeklyTrendDelta === null
      ? 'N/D'
      : weeklyTrendDelta >= 0
      ? `+${weeklyTrendDelta}`
      : `${weeklyTrendDelta}`,
    weeklyTrendDelta === null
      ? 'Sem histórico'
      : weeklyTrendDelta === 0
      ? 'Estável'
      : 'vs. semana anterior',
    weeklyTrendDelta === null
      ? COLORS.gray
      : weeklyTrendDelta > 0
      ? COLORS.success
      : weeklyTrendDelta < 0
      ? COLORS.danger
      : COLORS.warning
  );

  // Streak de Hábitos
  yPosition = addMetricCard(
    pdf,
    margin + (cardWidth + 5) * 2,
    yPosition - 40,
    cardWidth,
    'Streak Atual',
    `${habitStats.currentStreak} dias`,
    `Performance média: ${habitStats.avgPerformance.toFixed(0)}%`,
    COLORS.primary
  );

  yPosition += 10;

  // ROI (se permitido)
  const canSeeFinancialROI =
    profile.role === 'SUPER_ADMIN' ||
    profile.role === 'TREINADOR' ||
    profile.role === 'PROPRIETARIO_EMPRESA';

  if (canSeeFinancialROI) {
    yPosition = addSection(pdf, yPosition, 'Retorno sobre Investimento');

    const totalRevenue = roiResults.reduce(
      (acc, curr) => acc + Number(curr.amount ?? 0),
      0
    );
    const baselineIncome = Number(
      roiBaseline?.baseline_income ?? roiBaseline?.initial_revenue ?? 0
    );
    const goalIncome = Number(
      roiBaseline?.goal_income ?? roiBaseline?.target_revenue ?? 0
    );
    const roiVsBaseline = baselineIncome > 0 ? (totalRevenue / baselineIncome) * 100 : 0;
    const goalProgress = goalIncome > 0 ? (totalRevenue / goalIncome) * 100 : 0;

    const roiCardWidth = (pageWidth - 2 * margin - 5) / 2;

    yPosition = addMetricCard(
      pdf,
      margin,
      yPosition,
      roiCardWidth,
      'ROI Acumulado',
      formatCurrency(totalRevenue),
      baselineIncome > 0
        ? `${roiVsBaseline.toFixed(0)}% sobre a base`
        : goalIncome > 0
        ? `${goalProgress.toFixed(0)}% da meta`
        : 'Sem base negociada',
      COLORS.success
    );

    yPosition = addMetricCard(
      pdf,
      margin + roiCardWidth + 5,
      yPosition - 40,
      roiCardWidth,
      'Meta de ROI',
      goalIncome > 0 ? formatCurrency(goalIncome) : 'N/A',
      goalIncome > 0
        ? `${goalProgress.toFixed(0)}% alcançado`
        : 'Meta não definida',
      goalIncome > 0 && goalProgress >= 100 ? COLORS.success : COLORS.warning
    );

    yPosition += 10;
  }

  // Nova página para gráficos e objetivos
  pdf.addPage();
  yPosition = 20;

  // Gráfico de Evolução Semanal
  yPosition = addSection(pdf, yPosition, 'Evolução Semanal');

  const chartData =
    weeklyScores.length > 0
      ? weeklyScores.slice(-8).map((score) => ({
          label: `Sem ${score.week_number}`,
          value: Math.round(Number(score.score ?? 0)),
        }))
      : [{ label: 'Atual', value: Math.round(summary.weeklyScore) }];

  yPosition = addBarChart(
    pdf,
    margin,
    yPosition,
    pageWidth - 2 * margin,
    60 + chartData.length * 16,
    chartData,
    'Progresso das últimas semanas'
  );

  // Progresso do Ciclo
  if (activeCycle) {
    yPosition = addSection(pdf, yPosition, 'Progresso do Ciclo');

    pdf.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 30, 3, 3, 'FD');

    pdf.setFontSize(9);
    pdf.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
    pdf.text(`Ciclo ${activeCycle.number}`, margin + 5, yPosition + 10);

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    pdf.text(`${summary.cycleScore}%`, margin + 5, yPosition + 20);

    // Progress bar
    pdf.setFillColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    pdf.roundedRect(margin + 40, yPosition + 12, pageWidth - 2 * margin - 50, 6, 2, 2, 'F');
    pdf.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    pdf.roundedRect(
      margin + 40,
      yPosition + 12,
      ((pageWidth - 2 * margin - 50) * summary.cycleProgress) / 100,
      6,
      2,
      2,
      'F'
    );

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
    pdf.text(
      `${summary.currentWeek}/${summary.totalWeeks} semanas`,
      pageWidth - margin - 5,
      yPosition + 17,
      { align: 'right' }
    );

    yPosition += 40;
  }

  // Objetivos e Progresso
  if (goals.length > 0 && yPosition > pageHeight - 80) {
    pdf.addPage();
    yPosition = 20;
  }

  if (goals.length > 0) {
    yPosition = addSection(pdf, yPosition, 'Objetivos e Progresso');

    const goalsData = goals.slice(0, 5).map((goal) => ({
      title: goal.title,
      description: goal.description || undefined,
      progress: goal.progress,
    }));

    yPosition = addItemList(
      pdf,
      margin,
      yPosition,
      pageWidth - 2 * margin,
      goalsData,
      `Objetivos Ativos (${goals.length})`
    );
  }

  // Hábitos
  if (yPosition > pageHeight - 100) {
    pdf.addPage();
    yPosition = 20;
  }

  if (habits.length > 0) {
    yPosition = addSection(pdf, yPosition, 'Hábitos');

    const habitsData = habits.slice(0, 5).map((habit) => {
      const completedCheckins = habit.checkins?.filter((c) => c.status).length || 0;
      const totalCheckins = habit.checkins?.length || 1;
      const progress = Math.round((completedCheckins / totalCheckins) * 100);

      return {
        title: habit.name,
        description: habit.type === 'build' ? 'Hábito a construir' : 'Hábito a abandonar',
        progress,
      };
    });

    yPosition = addItemList(
      pdf,
      margin,
      yPosition,
      pageWidth - 2 * margin,
      habitsData,
      `Hábitos Ativos (${habits.length})`
    );
  }

  // Footer
  const pageCount = pdf.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
    pdf.text(
      `Página ${i} de ${pageCount} • Instituto Caminhos do Êxito`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Salvar PDF
  const defaultFilename = `relatorio-aluno-${profile.full_name?.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  pdf.save(filename || defaultFilename);
}

/**
 * RF39: Gera PDF da turma em formato resumido
 * @param turmaData - Dados da turma
 * @param filename - Nome do arquivo (opcional)
 * @returns Promise<void>
 */
export async function generateTurmaPDF(
  turmaData: {
    turma: Turma;
    program: Program | null;
    trainer: Profile | null;
    members: Array<{
      enrollment: Enrollment;
      profile: Profile | null;
      cycle: Cycle | null;
      weeklyScores: WeeklyScore[];
      habitStats: { currentStreak: number; avgPerformance: number };
    }>;
    turmaMetrics: {
      avgScore: number;
      activeMembers: number;
      atRiskMembers: number;
      onTrackMembers: number;
      avgStreak: number;
    };
  },
  filename?: string
): Promise<void> {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = 0;

  const { turma, program, trainer, members, turmaMetrics } = turmaData;

  // Cabeçalho do documento
  yPosition = addDocumentHeader(
    pdf,
    'Relatório da Turma',
    `Visão geral de desempenho e progresso coletivo`
  );

  // Informações da Turma
  yPosition = addSection(pdf, yPosition, 'Informações da Turma');

  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  pdf.text(`Nome: ${turma.name}`, margin, yPosition);
  pdf.text(
    `Programa: ${program?.name || 'Não vinculado'}`,
    margin,
    yPosition + 8
  );
  pdf.text(
    `Treinador: ${trainer?.full_name || 'Não atribuído'}`,
    margin,
    yPosition + 16
  );
  pdf.text(
    `Início: ${format(parseISO(turma.start_date), 'dd/MM/yyyy', { locale: ptBR })}`,
    margin + 80,
    yPosition
  );
  pdf.text(
    `Fechamento: Dia ${turma.fechamento_dia} às ${turma.fechamento_hora}`,
    margin + 80,
    yPosition + 8
  );
  pdf.text(
    `Duração: ${turma.weeks_count || 'N/A'} semanas`,
    margin + 80,
    yPosition + 16
  );

  yPosition += 30;

  // Métricas da Turma
  yPosition = addSection(pdf, yPosition, 'Métricas Coletivas');

  const cardWidth = (pageWidth - 2 * margin - 10) / 3;

  // Score Médio
  yPosition = addMetricCard(
    pdf,
    margin,
    yPosition,
    cardWidth,
    'Score Médio',
    `${turmaMetrics.avgScore.toFixed(0)}%`,
    'Média da turma',
    COLORS.primary
  );

  // Membros Ativos
  yPosition = addMetricCard(
    pdf,
    margin + cardWidth + 5,
    yPosition - 40,
    cardWidth,
    'Membros Ativos',
    `${turmaMetrics.activeMembers}`,
    `Total de ${members.length} alunos`,
    COLORS.success
  );

  // Streak Médio
  yPosition = addMetricCard(
    pdf,
    margin + (cardWidth + 5) * 2,
    yPosition - 40,
    cardWidth,
    'Streak Médio',
    `${turmaMetrics.avgStreak.toFixed(0)} dias`,
    'Média de hábitos',
    COLORS.warning
  );

  yPosition += 10;

  // Status dos Membros
  yPosition = addSection(pdf, yPosition, 'Status da Turma');

  const statusCardWidth = (pageWidth - 2 * margin - 5) / 2;

  yPosition = addMetricCard(
    pdf,
    margin,
    yPosition,
    statusCardWidth,
    'Em Risco',
    `${turmaMetrics.atRiskMembers}`,
    'Abaixo da meta de desempenho',
    COLORS.danger
  );

  yPosition = addMetricCard(
    pdf,
    margin + statusCardWidth + 5,
    yPosition - 40,
    statusCardWidth,
    'Na Meta',
    `${turmaMetrics.onTrackMembers}`,
    'Alcançando objetivos',
    COLORS.success
  );

  yPosition += 10;

  // Nova página para lista de alunos
  pdf.addPage();
  yPosition = 20;

  // Lista de Alunos
  yPosition = addSection(pdf, yPosition, 'Alunos da Turma');

  const membersData = members.map((member) => {
    const currentScore =
      member.weeklyScores.length > 0
        ? member.weeklyScores[member.weeklyScores.length - 1]?.score ?? 0
        : 0;
    const isAtRisk = currentScore < 70;
    const status = isAtRisk ? 'Em risco' : 'Na meta';

    return {
      title: member.profile?.full_name || 'Aluno sem nome',
      description: member.profile?.email || 'Sem email',
      status,
      progress: Math.round(currentScore),
    };
  });

  yPosition = addItemList(
    pdf,
    margin,
    yPosition,
    pageWidth - 2 * margin,
    membersData,
    `Lista de Alunos (${members.length})`
  );

  // Gráfico Coletivo Simplificado
  if (yPosition > pageHeight - 120) {
    pdf.addPage();
    yPosition = 20;
  }

  yPosition = addSection(pdf, yPosition, 'Distribuição de Performance');

  // Calcular distribuição de performance
  const performanceBands = [
    { label: 'Excelente (90-100%)', min: 90, max: 100, count: 0 },
    { label: 'Bom (70-89%)', min: 70, max: 89, count: 0 },
    { label: 'Atenção (50-69%)', min: 50, max: 69, count: 0 },
    { label: 'Crítico (<50%)', min: 0, max: 49, count: 0 },
  ];

  members.forEach((member) => {
    const score =
      member.weeklyScores.length > 0
        ? member.weeklyScores[member.weeklyScores.length - 1]?.score ?? 0
        : 0;
    const band = performanceBands.find((b) => score >= b.min && score <= b.max);
    if (band) band.count++;
  });

  const chartData = performanceBands.map((band) => {
    let color = COLORS.gray;
    if (band.min >= 90) color = COLORS.success;
    else if (band.min >= 70) color = COLORS.primary;
    else if (band.min >= 50) color = COLORS.warning;
    else color = COLORS.danger;

    return {
      label: band.label,
      value: band.count,
      color,
    };
  });

  addBarChart(
    pdf,
    margin,
    yPosition,
    pageWidth - 2 * margin,
    80,
    chartData,
    'Distribuição por faixa de performance'
  );

  // Footer
  const pageCount = pdf.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
    pdf.text(
      `Página ${i} de ${pageCount} • Instituto Caminhos do Êxito`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Salvar PDF
  const defaultFilename = `relatorio-turma-${turma.name.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  pdf.save(filename || defaultFilename);
}
