import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  Flame,
  History,
  LayoutDashboard,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Loader2,
} from 'lucide-react';
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isHabitDueOnDate, useEnrollments, useGamification, useHabits, usePlan12WY, useROI } from '../hooks/useData';
import { canViewFinancialROI } from '../lib/roiAccess';
import { cn } from '../lib/utils';
import { getBadgeIcon } from '../lib/badgeIcons';
import { generateStudentPDF } from '../lib/pdfExport';

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function formatTrendLabel(delta: number | null) {
  if (delta === null) return 'Sem histórico';
  if (delta === 0) return 'Estável';
  return delta > 0 ? `+${delta} pts vs. semana anterior` : `${delta} pts vs. semana anterior`;
}

function isErrorLike(value: unknown): value is { message?: string } {
  return Boolean(value && typeof value === 'object' && 'message' in value);
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const { habits, stats: habitStats, loading: habitsLoading, markHabitCheckin } = useHabits();
  const { results, baseline, baselines, loading: roiLoading } = useROI();
  const { goals, activeCycle, loading: planLoading, summary, weeklyScores, weeklyTaskGroups, toggleTaskCheckin } = usePlan12WY();
  const { enrollments, loading: enrollmentsLoading } = useEnrollments();
  const { badges, availableBadges, loading: gamificationLoading } = useGamification();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const displayName = profile?.full_name?.split(' ')[0] || 'Aluno';
  const canSeeFinancialROI = canViewFinancialROI(profile?.role);
  const totalRevenue = results.reduce((acc, curr) => acc + Number(curr.amount ?? 0), 0);
  const baselineIncome = Number((baseline as any)?.baseline_income ?? (baseline as any)?.initial_revenue ?? 0);
  const goalIncome = Number((baseline as any)?.goal_income ?? (baseline as any)?.target_revenue ?? 0);
  const roiVsBaseline = baselineIncome > 0 ? (totalRevenue / baselineIncome) * 100 : 0;
  const goalProgress = goalIncome > 0 ? (totalRevenue / goalIncome) * 100 : 0;
  const currentStreak = habitStats.currentStreak ?? 0;
  const activeEnrollment = enrollments.find((enrollment: any) => enrollment?.status === 'active') ?? enrollments[0];
  const turmaName = activeEnrollment?.turmas?.name as string | undefined;
  const latestResult = results[0];
  const completedWeeks = activeCycle ? Math.max(0, summary.currentWeek - 1) : 0;
  const remainingWeeks = activeCycle ? Math.max(0, summary.totalWeeks - summary.currentWeek) : 0;
  const cycleScore = summary.cycleScore;
  const currentWeeklyScore = weeklyScores.length > 0 ? weeklyScores[weeklyScores.length - 1]?.score ?? summary.weeklyScore : summary.weeklyScore;
  const previousWeeklyScore = weeklyScores.length > 1 ? weeklyScores[weeklyScores.length - 2]?.score ?? null : null;
  const weeklyTrendDelta = previousWeeklyScore === null ? null : currentWeeklyScore - previousWeeklyScore;
  const weeklyTrendTone =
    weeklyTrendDelta === null || weeklyTrendDelta === 0
      ? 'text-neutral-400'
      : weeklyTrendDelta > 0
        ? 'text-emerald-400'
        : 'text-rose-400';
  const pendingTodayHabits = habits.filter(
    (habit) =>
      !habit.is_paused &&
      isHabitDueOnDate(habit, new Date()) &&
      !habit.checkins?.some((checkin) => checkin.date === todayKey && checkin.status)
  );
  const agendaTasks = weeklyTaskGroups.flatMap((group) => group.tasks);
  const pendingAgendaTasks = agendaTasks.filter((task) => !task.completedForDate);
  const nextTasks = pendingAgendaTasks.slice(0, 3);
  const primaryQuickTask = nextTasks[0] ?? agendaTasks[0] ?? null;
  const primaryQuickHabit = pendingTodayHabits[0] ?? null;
  const recentBadges = useMemo(
    () =>
      [...badges]
        .sort((left: any, right: any) => new Date(right.unlocked_at).getTime() - new Date(left.unlocked_at).getTime())
        .slice(0, 4),
    [badges]
  );
  const weeklySparkValues = useMemo(
    () => (weeklyScores.length > 0 ? weeklyScores : [{ score: summary.weeklyScore } as any]).slice(-4).map((entry) => Number(entry.score ?? 0)),
    [summary.weeklyScore, weeklyScores]
  );
  const unlockedBadgeCount = badges.length;
  const totalBadgeCount = availableBadges.length;
  const enrollmentsReady = !enrollmentsLoading;
  const quickTaskId = primaryQuickTask ? `task:${primaryQuickTask.id}:${primaryQuickTask.scheduledDate}` : null;
  const quickHabitId = primaryQuickHabit ? `habit:${primaryQuickHabit.id}` : null;
  const canTriggerQuickTask = Boolean(primaryQuickTask && !primaryQuickTask.completedForDate);
  const canTriggerQuickHabit = Boolean(primaryQuickHabit);
  const quickActionState = actionMessage ? (
    <div className="rounded-2xl border border-brand-green/20 bg-brand-green/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green">
      {actionMessage}
    </div>
  ) : null;
  const handleTaskQuickCheckin = async (task: any) => {
    if (!task) return;

    const loadingId = `task:${task.id}:${task.scheduledDate}`;
    setActionLoadingId(loadingId);
    setActionMessage(null);

    try {
      const error = await toggleTaskCheckin(task.id, task.scheduledDate, task.completedForDate);
      if (error) {
        setActionMessage(isErrorLike(error) && error.message ? error.message : 'Não foi possível concluir o check-in da tarefa.');
        return;
      }

      setActionMessage(`Check-in feito em ${task.title}.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleHabitQuickCheckin = async (habit: any) => {
    if (!habit) return;

    const loadingId = `habit:${habit.id}`;
    setActionLoadingId(loadingId);
    setActionMessage(null);

    try {
      const error = await markHabitCheckin(habit.id, todayKey, true);
      if (error) {
        setActionMessage(isErrorLike(error) && error.message ? error.message : 'Não foi possível concluir o check-in do hábito.');
        return;
      }

      setActionMessage(`Check-in feito em ${habit.name}.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExportPDF = async () => {
    if (!user || !profile) {
      setPdfMessage('Usuário não autenticado.');
      return;
    }

    setPdfLoading(true);
    setPdfMessage(null);

    try {
      await generateStudentPDF({
        profile,
        summary,
        weeklyScores,
        habits,
        habitStats,
        roiBaseline: baseline,
        roiResults: results,
        goals,
        activeCycle,
        enrollment: activeEnrollment,
      });

      setPdfMessage('PDF gerado com sucesso!');
      setTimeout(() => setPdfMessage(null), 3000);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setPdfMessage(isErrorLike(error) && error.message ? error.message : 'Não foi possível gerar o PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-10 pb-12 font-sans text-white">
      <header className="relative overflow-hidden rounded-[44px] border border-[#1a1a1a] bg-[#050505] p-8 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(102,255,102,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_32%)]" />
        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-brand-green">
                Dashboard do Aluno
              </span>
              <span className="rounded-full border border-[#1a1a1a] bg-black/40 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500">
                {profile?.role ? profile.role.replaceAll('_', ' ') : 'ALUNO'}
              </span>
              {turmaName ? (
                <span className="rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-brand-green">
                  Turma {turmaName}
                </span>
              ) : (
                <span className="rounded-full border border-[#1a1a1a] bg-black/40 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500">
                  Sem turma vinculada
                </span>
              )}
              <button
                onClick={handleExportPDF}
                disabled={pdfLoading}
                className="rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-brand-green hover:bg-brand-green/20 transition-all disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1"
              >
                {pdfLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    GERANDO...
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3" />
                    PDF
                  </>
                )}
              </button>
            </div>

            {pdfMessage && (
              <div className={cn(
                'rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em]',
                pdfMessage.includes('sucesso') ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              )}>
                {pdfMessage}
              </div>
            )}

            <div className="max-w-4xl space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.45em] text-brand-green">
                Home operacional do ciclo
              </p>
              <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-[0.85] md:text-7xl">
                {displayName}, seu dia começa aqui.
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-neutral-400 md:text-base">
                Acompanhe score semanal, tendência, streak, ROI acumulado e a próxima ação sem abrir
                outras telas. O que importa fica visível na primeira dobra.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {[
                { label: 'Plano', hint: 'Objetivos, táticas e tarefas', icon: Target, to: '/plano' },
                { label: 'Hábitos', hint: 'Check-ins e streak', icon: History, to: '/habitos' },
                { label: 'ROI', hint: 'Evolução financeira', icon: TrendingUp, to: '/roi' },
                { label: 'Turma', hint: 'Ranking e contexto', icon: Users, to: '/turma' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group rounded-[24px] border border-[#1a1a1a] bg-black/35 p-4 transition-all hover:border-brand-green/20 hover:bg-brand-green/5"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] transition-all group-hover:brand-gradient group-hover:text-black">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-neutral-700 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white">{item.label}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-neutral-500">{item.hint}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-[32px] border border-[#1a1a1a] bg-black/45 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-neutral-600">Hoje</p>
                <p className="mt-2 text-2xl font-black italic uppercase text-white">
                  {format(new Date(), "dd 'DE' MMMM", { locale: ptBR })}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-neutral-500">
                  {activeCycle ? `Semana ${summary.currentWeek} de ${summary.totalWeeks}` : 'Sem ciclo ativo'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient text-black">
                <Calendar className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-[22px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">Lembrete</p>
                <p className="mt-2 text-sm font-black italic uppercase text-white">
                  {profile?.habit_reminder_enabled ? profile.habit_reminder_time ?? '08:00' : 'Desativado'}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  {profile?.habit_reminder_enabled ? 'PWA ativo' : 'Ative em Hábitos'}
                </p>
              </div>
              <div className="rounded-[22px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">Vínculos</p>
                <p className="mt-2 text-sm font-black italic uppercase text-white">
                  {enrollmentsLoading ? '...' : enrollments.length}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  {enrollmentsReady && activeEnrollment?.turmas?.name ? 'Turma conectada' : 'Nenhuma turma'}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[22px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">Foco imediato</p>
              <p className="mt-2 text-sm font-black uppercase italic text-white">
                {pendingTodayHabits.length > 0 ? 'Hábitos pendentes de hoje' : 'Hoje já está em dia'}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                {summary.tasksDueToday} tarefa(s) previstas hoje · {pendingTodayHabits.length} hábito(s) em aberto
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">Score da semana</p>
          <p className="mt-3 text-4xl font-black italic uppercase text-white">
            {planLoading ? '...' : `${currentWeeklyScore}%`}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            {activeCycle ? `Semana ${summary.currentWeek}/${summary.totalWeeks}` : 'Sem ciclo ativo'}
          </p>
        </div>

        <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">Tendência</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className={cn('text-3xl font-black italic uppercase', weeklyTrendTone)}>
                {weeklyTrendDelta === null ? 'N/D' : weeklyTrendDelta > 0 ? `+${weeklyTrendDelta}` : `${weeklyTrendDelta}`}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                {formatTrendLabel(weeklyTrendDelta)}
              </p>
            </div>
            <div className="flex items-end gap-1">
              {weeklySparkValues.map((value, index) => (
                <span
                  key={`${index}-${value}`}
                  className="w-3 rounded-full bg-brand-green/70"
                  style={{ height: `${Math.max(12, Math.min(44, value * 0.35 + 12))}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">Streak</p>
          <p className="mt-3 text-4xl font-black italic uppercase text-white">
            {habitsLoading ? '...' : `${currentStreak}d`}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            Baseado em check-ins reais de hábitos
          </p>
        </div>

        <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">ROI acumulado</p>
          {canSeeFinancialROI ? (
            <>
              <p className="mt-3 text-4xl font-black italic uppercase text-white">
                {roiLoading ? '...' : formatMoney(totalRevenue)}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                {baselineIncome > 0 ? `${roiVsBaseline.toFixed(0)}% sobre a base` : goalIncome > 0 ? `${goalProgress.toFixed(0)}% da meta` : 'Sem base negociada'}
              </p>
              {latestResult ? (
                <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  Último lançamento: {latestResult.description || 'sem descrição'} · {formatMoney(Number(latestResult.amount ?? 0))}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="mt-3 text-2xl font-black italic uppercase text-white">Reservado</p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Este papel não vê ROI financeiro
              </p>
            </>
          )}
        </div>

        <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">Próximas tarefas</p>
          <p className="mt-3 text-4xl font-black italic uppercase text-white">
            {planLoading ? '...' : `${nextTasks.length}`}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            Ocorrências pendentes nesta semana
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-[40px] border border-[#1a1a1a] bg-[#050505] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-brand-green">
                RF29 · Ação de Hoje
              </p>
              <h2 className="mt-2 text-3xl font-black italic uppercase tracking-tighter">
                Check-in rápido sem sair da home
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
                Conclua a primeira tarefa em aberto ou marque o hábito do dia direto daqui.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500">
              <span className="rounded-full border border-[#1a1a1a] bg-black/40 px-3 py-1">
                {summary.completedToday}/{summary.tasksDueToday} tarefas
              </span>
              <span className="rounded-full border border-[#1a1a1a] bg-black/40 px-3 py-1">
                {pendingTodayHabits.length} hábitos abertos
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[30px] border border-[#1a1a1a] bg-black/35 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500">
                    Tarefa prioritária
                  </p>
                  <p className="mt-2 text-xl font-black uppercase italic text-white">
                    {primaryQuickTask ? primaryQuickTask.title : 'Nada pendente'}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    {primaryQuickTask ? `Agendada para ${format(parseISO(primaryQuickTask.scheduledDate), 'dd/MM', { locale: ptBR })}` : 'Hoje sem tarefa aberta'}
                  </p>
                </div>
                <CheckCircle2 className="h-6 w-6 text-brand-green" />
              </div>

              <button
                onClick={() => handleTaskQuickCheckin(primaryQuickTask)}
                disabled={!canTriggerQuickTask}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-brand-green transition-all disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionLoadingId === quickTaskId ? 'Salvando...' : 'Fazer check-in'}
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            <div className="rounded-[30px] border border-[#1a1a1a] bg-black/35 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500">
                    Hábito prioritário
                  </p>
                  <p className="mt-2 text-xl font-black uppercase italic text-white">
                    {primaryQuickHabit ? primaryQuickHabit.name : 'Nada pendente'}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    {primaryQuickHabit ? 'Previsto para hoje' : 'Nenhum hábito aberto'}
                  </p>
                </div>
                <Flame className="h-6 w-6 text-orange-500" />
              </div>

              <button
                onClick={() => handleHabitQuickCheckin(primaryQuickHabit)}
                disabled={!canTriggerQuickHabit}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionLoadingId === quickHabitId ? 'Salvando...' : 'Marcar feito'}
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-[30px] border border-[#1a1a1a] bg-black/25 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500">
                  Próximas tarefas
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  O que vem a seguir no ciclo desta semana
                </p>
              </div>
              <Link to="/plano" className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-green">
                Abrir plano
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {nextTasks.length > 0 ? (
                nextTasks.map((task) => (
                  <div key={`${task.id}-${task.scheduledDate}`} className="flex items-center justify-between gap-4 rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight text-white">{task.title}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                        {format(parseISO(task.scheduledDate), 'EEE, dd/MM', { locale: ptBR })}
                      </p>
                    </div>
                    <span className={cn('text-[9px] font-black uppercase tracking-[0.25em]', task.completedForDate ? 'text-brand-green' : 'text-neutral-500')}>
                      {task.completedForDate ? 'Concluída' : 'Pendente'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#1a1a1a] bg-[#0a0a0a] px-4 py-6 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  Não há tarefas pendentes na semana.
                </div>
              )}
            </div>

            {quickActionState ? <div className="mt-4">{quickActionState}</div> : null}

          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[40px] border border-[#1a1a1a] bg-[#050505] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-brand-green">
                  RF30 · Ciclo
                </p>
                <h2 className="mt-2 text-2xl font-black italic uppercase tracking-tighter">
                  Progresso do ciclo
                </h2>
              </div>
              <LayoutDashboard className="h-6 w-6 text-brand-green" />
            </div>

            {planLoading ? (
              <div className="mt-6 space-y-3 animate-pulse">
                <div className="h-8 rounded-2xl bg-white/5" />
                <div className="h-8 rounded-2xl bg-white/5" />
                <div className="h-24 rounded-[28px] bg-white/5" />
              </div>
            ) : activeCycle ? (
              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[24px] border border-[#1a1a1a] bg-black/35 p-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">
                      Semanas concluídas
                    </p>
                    <p className="mt-2 text-3xl font-black italic uppercase text-white">{completedWeeks}</p>
                  </div>
                  <div className="rounded-[24px] border border-[#1a1a1a] bg-black/35 p-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">
                      Semanas restantes
                    </p>
                    <p className="mt-2 text-3xl font-black italic uppercase text-white">{remainingWeeks}</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#1a1a1a] bg-black/35 p-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">
                    Score acumulado
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <p className="text-4xl font-black italic uppercase text-white">{cycleScore}%</p>
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-green">
                      Semana {summary.currentWeek}
                    </span>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full border border-[#1a1a1a] bg-[#0a0a0a] p-0.5">
                    <div
                      className="h-full rounded-full brand-gradient shadow-lg shadow-brand-green/40"
                      style={{ width: `${Math.min(100, summary.cycleProgress)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    {activeCycle.status === 'archived'
                      ? 'Ciclo arquivado para consulta'
                      : `Objetivos: ${summary.totalGoals} · Táticas: ${summary.totalTactics} · Tarefas: ${summary.totalTasks}`}
                  </p>
                </div>

                <div className="rounded-[24px] border border-[#1a1a1a] bg-black/35 p-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">
                    Próximo foco
                  </p>
                  <p className="mt-2 text-sm font-black uppercase italic text-white">
                    {goals[0]?.title || 'Sem objetivo principal ainda'}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    {goals[0]?.description || 'Defina o próximo passo do ciclo em Plano 12WY'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[28px] border border-dashed border-[#1a1a1a] bg-black/35 p-6">
                <Target className="h-6 w-6 text-brand-green" />
                <p className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-white">
                  Nenhum ciclo ativo
                </p>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                  Vincule o ciclo do aluno para liberar score, semanas e execução por tarefa.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-[40px] border border-[#1a1a1a] bg-[#050505] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-brand-green">
                  RF31 · Conquistas
                </p>
                <h2 className="mt-2 text-2xl font-black italic uppercase tracking-tighter">
                  Badges recentes
                </h2>
              </div>
              <Sparkles className="h-6 w-6 text-brand-green" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-[24px] border border-[#1a1a1a] bg-black/35 p-4">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">Desbloqueadas</p>
                <p className="mt-2 text-3xl font-black italic uppercase text-white">
                  {gamificationLoading ? '...' : `${unlockedBadgeCount}/${totalBadgeCount}`}
                </p>
              </div>
              <BadgeCheck className="h-7 w-7 text-brand-green" />
            </div>

            <div className="mt-4 space-y-3">
              {recentBadges.length > 0 ? (
                recentBadges.map((userBadge: any) => {
                  const badge = userBadge.badge;
                  const Icon = getBadgeIcon(badge?.icon);
                  return (
                    <div key={userBadge.id} className="flex items-center gap-4 rounded-[24px] border border-[#1a1a1a] bg-black/35 p-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl brand-gradient text-black">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black uppercase tracking-tight text-white">{badge?.name || 'Badge'}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                          {badge?.description || 'Conquista desbloqueada no ciclo'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-green">
                          {formatDistanceToNowStrict(new Date(userBadge.unlocked_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[28px] border border-dashed border-[#1a1a1a] bg-black/35 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                    Nenhuma badge conquistada ainda
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    Complete tarefas, hábitos e entregas para liberar as primeiras conquistas.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[40px] border border-[#1a1a1a] bg-[#050505] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-brand-green">
                  RF28 · Resumo
                </p>
                <h2 className="mt-2 text-2xl font-black italic uppercase tracking-tighter">
                  Execução geral
                </h2>
              </div>
              <BarChart3 className="h-6 w-6 text-brand-green" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[22px] border border-[#1a1a1a] bg-black/35 p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">Hábitos ativos</p>
                <p className="mt-2 text-2xl font-black italic uppercase text-white">{habits.length}</p>
              </div>
              <div className="rounded-[22px] border border-[#1a1a1a] bg-black/35 p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">Score hábito</p>
                <p className="mt-2 text-2xl font-black italic uppercase text-white">
                  {habitsLoading ? '...' : `${habitStats.avgPerformance}%`}
                </p>
              </div>
              <div className="rounded-[22px] border border-[#1a1a1a] bg-black/35 p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">Execução hoje</p>
                <p className="mt-2 text-2xl font-black italic uppercase text-white">
                  {summary.tasksDueToday > 0 ? `${summary.completedToday}/${summary.tasksDueToday}` : '0/0'}
                </p>
              </div>
              <div className="rounded-[22px] border border-[#1a1a1a] bg-black/35 p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neutral-600">ROI base</p>
                <p className="mt-2 text-2xl font-black italic uppercase text-white">
                  {roiLoading ? '...' : baselineIncome > 0 ? `${roiVsBaseline.toFixed(0)}%` : 'N/D'}
                </p>
              </div>
            </div>

          </section>
        </aside>
      </div>
    </div>
  );
}
