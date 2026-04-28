import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  Archive,
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleSlash2,
  LineChart,
  Loader2,
  Plus,
  Target,
  X,
} from 'lucide-react';
import {
  addDays,
  differenceInCalendarDays,
  differenceInWeeks,
  format,
  isSameDay,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { usePlan12WY } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

function formatFrequencyLabel(frequency?: string) {
  if (frequency === 'daily') return 'DIÁRIO';
  if (frequency === 'specific_days') return 'DIAS ESPECÍFICOS';
  if (frequency === 'weekly') return 'SEMANAL';
  return frequency?.toUpperCase() ?? 'DIÁRIO';
}

function formatGoalStatus(status?: string | null) {
  if (status === 'completed') return 'CONCLUÍDO';
  if (status === 'archived') return 'ARQUIVADO';
  return 'ATIVO';
}

function goalStatusClasses(status?: string | null) {
  if (status === 'completed') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if (status === 'archived') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  return 'border-[#262626] bg-[#141414] text-neutral-500';
}

function formatSpecificDays(days?: number[] | null) {
  if (!days?.length) return 'Nenhum dia específico';
  const labels = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => labels[day] ?? String(day))
    .join(' · ');
}

function specificDaysList(days?: number[] | null) {
  if (!days?.length) return [];
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => labels[day] ?? String(day));
}

function isErrorLike(value: unknown): value is { message?: string } {
  return Boolean(value && typeof value === 'object' && 'message' in value);
}

function toDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function parseLocalDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12);
}

function getSpecificDays(task: any): number[] {
  if (!Array.isArray(task?.specific_days)) return [];
  return task.specific_days
    .map((day: any) => Number(day))
    .filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function isTaskDueOnDate(task: any, date: Date, cycleStartDay: number) {
  const frequency = task?.frequency ?? 'daily';
  const day = date.getDay();
  const specificDays = getSpecificDays(task);

  if (frequency === 'weekly') return day === cycleStartDay;
  if (frequency === 'specific_days') return specificDays.includes(day);
  return true;
}

function countDueOccurrences(task: any, start: Date, end: Date, cycleStartDay: number) {
  if (end < start) return 0;
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  const final = new Date(end);
  final.setHours(12, 0, 0, 0);

  let count = 0;
  while (cursor <= final) {
    if (isTaskDueOnDate(task, cursor, cycleStartDay)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function flattenTasks(goals: any[]) {
  return goals.flatMap((goal) => goal.tactics.flatMap((tactic: any) => tactic.tasks.map((task: any) => ({ ...task, goal, tactic }))));
}

function buildCycleInsights(cycle: any, goals: any[], referenceDate = new Date()) {
  const cycleStart = new Date(cycle.start_date);
  const cycleStartDay = cycleStart.getDay();
  const allTasks = flattenTasks(goals);
  const now = referenceDate;
  const todayKey = toDateKey(now);
  const totalGoals = goals.length;
  const totalTactics = goals.reduce((sum, goal) => sum + goal.tactics.length, 0);
  const totalTasks = allTasks.length;
  const cycleProgress = totalGoals
    ? Math.round(goals.reduce((sum, goal) => sum + Number(goal.progress ?? 0), 0) / totalGoals)
    : 0;

  const completedToday = allTasks.filter((task) => {
    if (!isTaskDueOnDate(task, now, cycleStartDay)) return false;
    return (task.checkins ?? []).some((checkin: any) => checkin.date === todayKey && checkin.status === 'done');
  }).length;

  const tasksDueToday = allTasks.filter((task) => isTaskDueOnDate(task, now, cycleStartDay)).length;
  const weeklyWindowStart = addDays(now, -6);
  const weeklyExpected = allTasks.reduce(
    (sum, task) => sum + countDueOccurrences(task, weeklyWindowStart, now, cycleStartDay),
    0
  );
  const weeklyDone = allTasks.reduce((sum, task) => {
    return (
      sum +
      (task.checkins ?? []).filter((checkin: any) => {
        const checkinDate = parseLocalDateKey(checkin.date);
        return Boolean(
          checkin.status === 'done' &&
            checkinDate &&
            checkinDate >= weeklyWindowStart &&
            checkinDate <= now &&
            isTaskDueOnDate(task, checkinDate, cycleStartDay)
        );
      }).length
    );
  }, 0);

  const history = Array.from({ length: 12 }, (_, index) => {
    const weekStart = addDays(cycleStart, index * 7);
    const weekEnd = addDays(weekStart, 6);
    const cappedEnd = weekEnd > now ? now : weekEnd;
    const expected = allTasks.reduce(
      (sum, task) => sum + countDueOccurrences(task, weekStart, cappedEnd, cycleStartDay),
      0
    );
    const completed = allTasks.reduce((sum, task) => {
      return (
        sum +
        (task.checkins ?? []).filter((checkin: any) => {
          const checkinDate = parseLocalDateKey(checkin.date);
          return Boolean(
            checkin.status === 'done' &&
              checkinDate &&
              checkinDate >= weekStart &&
              checkinDate <= cappedEnd &&
              isTaskDueOnDate(task, checkinDate, cycleStartDay)
          );
        }).length
      );
    }, 0);

    return {
      week: index + 1,
      label: `S${index + 1}`,
      score: expected > 0 ? Math.round((completed / expected) * 100) : null,
      completed,
      expected,
      current: now >= weekStart && now <= weekEnd,
    };
  });
  const scoredHistory = history.filter((point) => point.score !== null);
  const cycleScore = scoredHistory.length
    ? Math.round(scoredHistory.reduce((sum, point) => sum + Number(point.score ?? 0), 0) / scoredHistory.length)
    : 0;

  const weeklyView = Array.from({ length: 7 }, (_, index) => {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const date = addDays(weekStart, index);
    const dateKey = toDateKey(date);
    const dayTasks = allTasks
      .filter((task) => isTaskDueOnDate(task, date, cycleStartDay))
      .map((task) => {
        const checkin = (task.checkins ?? []).find((entry: any) => entry.date === dateKey);
        return {
          id: task.id,
          title: task.title,
          frequency: task.frequency,
          goalTitle: task.goal?.title ?? '',
          tacticTitle: task.tactic?.title ?? '',
          dateKey,
          completed: checkin?.status === 'done',
          dueToday: isSameDay(date, now),
          progress: Number(task.progress ?? 0),
          weeklyProgress: Number(task.weeklyProgress ?? 0),
          checkinsCount: (task.checkins ?? []).length,
        };
      });

    return {
      date,
      dateKey,
      label: format(date, 'EEE', { locale: ptBR }).toUpperCase(),
      shortLabel: format(date, 'dd/MM'),
      isToday: isSameDay(date, now),
      tasks: dayTasks,
      dueCount: dayTasks.length,
      doneCount: dayTasks.filter((task) => task.completed).length,
    };
  });

  return {
    cycle,
    cycleWeek: Math.max(1, Math.min(12, differenceInWeeks(now, cycleStart) + 1)),
    summary: {
      cycleProgress,
      weeklyScore: weeklyExpected > 0 ? Math.round((weeklyDone / weeklyExpected) * 100) : 0,
      cycleScore,
      completedToday,
      tasksDueToday,
      totalTasks,
      totalGoals,
      totalTactics,
    },
    history,
    weeklyView,
  };
}

function enrichGoalsFromRaw(cycle: any, goalsData: any[], tacticsData: any[], tasksData: any[], checkinsData: any[]) {
  const cycleStart = new Date(cycle.start_date);
  const cycleStartDay = cycleStart.getDay();
  const now = cycle.status === 'archived' && cycle.end_date ? new Date(cycle.end_date) : new Date();
  const todayKey = toDateKey(now);
  const sevenDaysAgo = addDays(now, -6);

  const tacticsByGoal = tacticsData.reduce<Record<string, any[]>>((acc, tactic) => {
    const goalId = tactic.goal_id;
    if (!goalId) return acc;
    acc[goalId] = acc[goalId] ?? [];
    acc[goalId].push(tactic);
    return acc;
  }, {});

  const tasksByTactic = tasksData.reduce<Record<string, any[]>>((acc, task) => {
    const tacticId = task.tactic_id ?? task.tatic_id;
    if (!tacticId) return acc;
    acc[tacticId] = acc[tacticId] ?? [];
    acc[tacticId].push(task);
    return acc;
  }, {});

  const checkinsByTask = checkinsData.reduce<Record<string, any[]>>((acc, checkin) => {
    if (!checkin.task_id) return acc;
    acc[checkin.task_id] = acc[checkin.task_id] ?? [];
    acc[checkin.task_id].push(checkin);
    return acc;
  }, {});

  return goalsData.map((goal: any) => {
    const relatedTactics = tacticsByGoal[goal.id] ?? [];
    const enrichedTactics = relatedTactics.map((tactic: any) => {
      const relatedTasks = tasksByTactic[tactic.id] ?? [];
      const enrichedTasks = relatedTasks.map((task: any) => {
        const taskCheckins = checkinsByTask[task.id] ?? [];
        const doneCheckins = taskCheckins.filter((checkin) => {
          const checkinDate = parseLocalDateKey(checkin.date);
          return Boolean(
            checkin.status === 'done' &&
              checkinDate &&
              checkinDate >= cycleStart &&
              checkinDate <= now &&
              isTaskDueOnDate(task, checkinDate, cycleStartDay)
          );
        });
        const expectedOccurrences = countDueOccurrences(task, cycleStart, now, cycleStartDay);
        const weeklyExpectedOccurrences = countDueOccurrences(task, sevenDaysAgo, now, cycleStartDay);
        const weeklyDone = taskCheckins.filter((checkin: any) => {
          const checkinDate = parseLocalDateKey(checkin.date);
          return Boolean(
            checkin.status === 'done' &&
              checkinDate &&
              checkinDate >= sevenDaysAgo &&
              checkinDate <= now &&
              isTaskDueOnDate(task, checkinDate, cycleStartDay)
          );
        }).length;
        const todayCheckin = taskCheckins.find((checkin: any) => checkin.date === todayKey);

        return {
          ...task,
          checkins: taskCheckins,
          progress: expectedOccurrences > 0 ? Math.round((doneCheckins.length / expectedOccurrences) * 100) : 0,
          weeklyProgress: weeklyExpectedOccurrences > 0 ? Math.round((weeklyDone / weeklyExpectedOccurrences) * 100) : 0,
          completedToday: todayCheckin?.status === 'done',
          dueToday: isTaskDueOnDate(task, now, cycleStartDay),
        };
      });

      const totalTasks = enrichedTasks.length;
      return {
        ...tactic,
        tasks: enrichedTasks,
        progress: totalTasks
          ? Math.round(enrichedTasks.reduce((sum, task) => sum + task.progress, 0) / totalTasks)
          : 0,
        completedTasks: enrichedTasks.filter((task) => task.completedToday).length,
        totalTasks,
      };
    });

    const totalTactics = enrichedTactics.length;
    return {
      ...goal,
      tactics: enrichedTactics,
      progress: totalTactics
        ? Math.round(enrichedTactics.reduce((sum, tactic) => sum + tactic.progress, 0) / totalTactics)
        : 0,
      completedTasks: enrichedTactics.reduce((sum, tactic) => sum + tactic.completedTasks, 0),
      totalTasks: enrichedTactics.reduce((sum, tactic) => sum + tactic.totalTasks, 0),
    };
  });
}

export default function Plan12WY() {
  const { user } = useAuth();
  const {
    goals,
    activeCycle,
    loading,
    error,
    fetchPlan,
    clearError,
    createCycle,
    addGoal,
    addTactic,
    addTask,
    toggleTaskCheckin,
  } = usePlan12WY();
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [isAddingTactic, setIsAddingTactic] = useState<string | null>(null);
  const [isAddingTask, setIsAddingTask] = useState<string | null>(null);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDescription, setNewGoalDescription] = useState('');
  const [newGoalIndicator, setNewGoalIndicator] = useState('');
  const [newGoalDeadline, setNewGoalDeadline] = useState('');
  const [newTacticTitle, setNewTacticTitle] = useState('');
  const [newTacticDescription, setNewTacticDescription] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskFrequency, setNewTaskFrequency] = useState<'daily' | 'specific_days' | 'weekly'>('daily');
  const [newTaskSpecificDays, setNewTaskSpecificDays] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [archivedCycles, setArchivedCycles] = useState<any[]>([]);
  const [archivedViews, setArchivedViews] = useState<Record<string, any>>({});
  const [selectedArchivedCycleId, setSelectedArchivedCycleId] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const currentWeek = activeCycle
    ? Math.max(1, Math.min(12, differenceInWeeks(new Date(), new Date(activeCycle.start_date)) + 1))
    : 1;
  const activeView = useMemo(
    () => (activeCycle ? buildCycleInsights(activeCycle, goals, new Date()) : null),
    [activeCycle, goals]
  );
  const selectedArchivedView = selectedArchivedCycleId ? archivedViews[selectedArchivedCycleId] ?? null : null;
  const mainView = activeCycle ? activeView : selectedArchivedView;
  const goalLimitReached = goals.length >= 3;
  const canEditCycle = Boolean(activeCycle) && !goalLimitReached;
  const primaryActionLabel = activeCycle
    ? goalLimitReached
      ? 'Limite 3/3'
      : 'Novo Objetivo'
    : 'Iniciar Ciclo 12WY';

  const loadArchivedCycle = async (cycleId: string) => {
    if (archivedViews[cycleId]) {
      setSelectedArchivedCycleId(cycleId);
      return;
    }

    setArchiveLoading(true);
    setArchiveError(null);

    try {
      const [{ data: cycle, error: cycleError }, { data: goalsData, error: goalsError }] = await Promise.all([
        supabase.from('cycles').select('*').eq('id', cycleId).maybeSingle(),
        supabase.from('goals').select('*').eq('cycle_id', cycleId).order('order', { ascending: true }),
      ]);

      if (cycleError) throw cycleError;
      if (goalsError) throw goalsError;
      if (!cycle) throw new Error('Ciclo arquivado não encontrado.');

      const goalIds = (goalsData ?? []).map((goal: any) => goal.id);
      const tacticResult = goalIds.length
        ? await supabase.from('tactics').select('*').in('goal_id', goalIds).order('order', { ascending: true })
        : ({ data: [], error: null } as any);
      if (tacticResult.error) throw tacticResult.error;

      const tacticIds = (tacticResult.data ?? []).map((tactic: any) => tactic.id);
      const taskResult = tacticIds.length
        ? await supabase.from('tasks').select('*').in('tactic_id', tacticIds).order('created_at', { ascending: true })
        : ({ data: [], error: null } as any);
      if (taskResult.error) throw taskResult.error;

      const taskIds = (taskResult.data ?? []).map((task: any) => task.id);
      const checkinResult = taskIds.length
        ? await supabase.from('task_checkins').select('*').in('task_id', taskIds).order('date', { ascending: false })
        : ({ data: [], error: null } as any);
      if (checkinResult.error) throw checkinResult.error;

      const enrichedGoals = enrichGoalsFromRaw(
        cycle,
        goalsData ?? [],
        tacticResult.data ?? [],
        taskResult.data ?? [],
        checkinResult.data ?? []
      );
      const insights = buildCycleInsights(
        cycle,
        enrichedGoals,
        cycle.status === 'archived' && cycle.end_date ? new Date(cycle.end_date) : new Date()
      );

      setArchivedViews((prev) => ({
        ...prev,
        [cycleId]: {
          cycle,
          goals: enrichedGoals,
          ...insights,
        },
      }));
      setSelectedArchivedCycleId(cycleId);
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Não foi possível abrir o ciclo arquivado.');
    } finally {
      setArchiveLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchArchivedCycles = async () => {
      if (!user) {
        if (!cancelled) {
          setArchivedCycles([]);
          setArchivedViews({});
          setSelectedArchivedCycleId(null);
          setArchiveError(null);
          setArchiveLoading(false);
        }
        return;
      }

      setArchiveLoading(true);
      setArchiveError(null);
      try {
        const { data, error: cyclesError } = await supabase
          .from('cycles')
          .select('*')
          .eq('aluno_id', user.id)
          .eq('status', 'archived')
          .order('number', { ascending: false });

        if (cyclesError) throw cyclesError;

        if (cancelled) return;
        const cycles = (data ?? []) as any[];
        setArchivedCycles(cycles);

        if (!activeCycle && !selectedArchivedCycleId && cycles.length > 0) {
          void loadArchivedCycle(cycles[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setArchiveError(err instanceof Error ? err.message : 'Não foi possível carregar os ciclos arquivados.');
        }
      } finally {
        if (!cancelled) {
          setArchiveLoading(false);
        }
      }
    };

    void fetchArchivedCycles();

    return () => {
      cancelled = true;
    };
  }, [activeCycle, user]);

  const historyData = activeView?.history ?? selectedArchivedView?.history ?? [];
  const weeklyView = activeView?.weeklyView ?? selectedArchivedView?.weeklyView ?? [];
  const detailSummary = activeView?.summary ?? selectedArchivedView?.summary ?? {
    cycleProgress: 0,
    weeklyScore: 0,
    cycleScore: 0,
    completedToday: 0,
    tasksDueToday: 0,
    totalTasks: 0,
    totalGoals: 0,
    totalTactics: 0,
  };
  const displayWeek = mainView?.cycleWeek ?? currentWeek;
  const displayGoalCount = mainView?.summary.totalGoals ?? goals.length;
  const currentGoals = activeCycle ? goals : selectedArchivedView?.goals ?? [];
  const currentGoalsReadOnly = !activeCycle;
  const mainViewStartDate = mainView?.cycle?.start_date ?? activeCycle?.start_date ?? selectedArchivedView?.cycle?.start_date ?? null;
  const historyChartData = historyData.map((point: any) => ({
    label: point.label,
    score: point.score ?? 0,
    rawScore: point.score,
    completed: point.completed,
    expected: point.expected,
    current: point.current,
  }));

  const openGoalModal = () => {
    if (!canEditCycle) {
      setModalError(goalLimitReached ? 'O ciclo já atingiu o limite de 3 objetivos.' : 'Crie ou selecione um ciclo ativo para adicionar objetivos.');
      return;
    }
    resetGoalForm();
    setModalError(null);
    setIsAddingGoal(true);
  };

  const openTacticModal = (goalId: string) => {
    resetTacticForm();
    setModalError(null);
    setIsAddingTactic(goalId);
  };

  const openTaskModal = (tacticId: string) => {
    resetTaskForm();
    setModalError(null);
    setIsAddingTask(tacticId);
  };

  const closeModals = () => {
    resetGoalForm();
    resetTacticForm();
    resetTaskForm();
    setIsAddingGoal(false);
    setIsAddingTactic(null);
    setIsAddingTask(null);
    setModalError(null);
  };

  const resetGoalForm = () => {
    setNewGoalTitle('');
    setNewGoalDescription('');
    setNewGoalIndicator('');
    setNewGoalDeadline('');
  };

  const resetTacticForm = () => {
    setNewTacticTitle('');
    setNewTacticDescription('');
  };

  const resetTaskForm = () => {
    setNewTaskTitle('');
    setNewTaskFrequency('daily');
    setNewTaskSpecificDays('');
  };

  const parseSpecificDays = (raw: string) =>
    raw
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  const handleCreateCycle = async () => {
    setActionLoading(true);
    setModalError(null);
    try {
      const start = new Date().toISOString();
      const result = await createCycle(start);
      if (result?.error) {
        setModalError(result.error.message ?? 'Não foi possível criar o ciclo.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrimaryAction = activeCycle ? openGoalModal : handleCreateCycle;

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) {
      setModalError('Informe o título do objetivo.');
      return;
    }
    if (goalLimitReached) {
      setModalError('O ciclo já atingiu o limite de 3 objetivos.');
      return;
    }
    setActionLoading(true);
    setModalError(null);
    try {
      const errorResult = await addGoal({
        title: newGoalTitle.trim(),
        description: newGoalDescription.trim() || undefined,
        indicator: newGoalIndicator.trim() || undefined,
        deadline: newGoalDeadline || undefined,
      });
      if (errorResult) {
        setModalError(isErrorLike(errorResult) && errorResult.message ? errorResult.message : 'Não foi possível criar o objetivo.');
        return;
      }
      resetGoalForm();
      setIsAddingGoal(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTactic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddingTactic) return;
    if (!newTacticTitle.trim()) {
      setModalError('Informe o título da tática.');
      return;
    }
    setActionLoading(true);
    setModalError(null);
    try {
      const errorResult = await addTactic(isAddingTactic, {
        title: newTacticTitle.trim(),
        description: newTacticDescription.trim() || undefined,
      });
      if (errorResult) {
        setModalError(isErrorLike(errorResult) && errorResult.message ? errorResult.message : 'Não foi possível criar a tática.');
        return;
      }
      resetTacticForm();
      setIsAddingTactic(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddingTask) return;
    if (!newTaskTitle.trim()) {
      setModalError('Informe o título da tarefa.');
      return;
    }

    const specificDays = newTaskFrequency === 'specific_days' ? parseSpecificDays(newTaskSpecificDays) : [];
    if (newTaskFrequency === 'specific_days' && specificDays.length === 0) {
      setModalError('Informe ao menos um dia da semana em formato 0,1,2...');
      return;
    }

    setActionLoading(true);
    setModalError(null);
    try {
      const errorResult = await addTask(isAddingTask, {
        title: newTaskTitle.trim(),
        frequency: newTaskFrequency,
        specificDays,
      });
      if (errorResult) {
        setModalError(isErrorLike(errorResult) && errorResult.message ? errorResult.message : 'Não foi possível criar a tarefa.');
        return;
      }
      resetTaskForm();
      setIsAddingTask(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    setActionLoading(true);
    setModalError(null);
    try {
      const errorResult = await toggleTaskCheckin(taskId, todayKey, currentStatus);
      if (errorResult) {
        setModalError(isErrorLike(errorResult) && errorResult.message ? errorResult.message : 'Não foi possível atualizar o check-in.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-12 pb-12 text-white font-sans">
      {(error || modalError || archiveError) && (
        <div className="flex items-start gap-3 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em]">Atenção</p>
            <p className="mt-1 text-sm text-amber-50/90">{modalError || error || archiveError}</p>
          </div>
          <div className="flex items-center gap-3">
            {(error || archiveError) && (
              <button
                onClick={() => {
                  clearError();
                  setArchiveError(null);
                  fetchPlan();
                }}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100 hover:text-white"
              >
                Recarregar
              </button>
            )}
            <button
              onClick={() => {
                setModalError(null);
                clearError();
                setArchiveError(null);
              }}
              className="text-amber-100 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <header className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">
              Plano 12WY
            </span>
            <span className="rounded-full border border-[#262626] bg-[#0a0a0a] px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
              {activeCycle ? `Ciclo ativo #${activeCycle.number}` : selectedArchivedView ? `Ciclo arquivado #${selectedArchivedView.cycle.number}` : 'Sem ciclo ativo'}
            </span>
            <span className="rounded-full border border-[#262626] bg-[#0a0a0a] px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
              {displayGoalCount}/3 objetivos
            </span>
          </div>
          <h1 className="text-6xl font-black italic uppercase leading-none tracking-tighter">Plano 12WY</h1>
          <p className="max-w-2xl text-sm font-bold tracking-tight text-neutral-500">
            {mainViewStartDate
              ? `Ciclo iniciado em ${format(new Date(mainViewStartDate), 'dd/MM/yyyy')}. Histórico, score semanal e visão por dia são calculados a partir dos check-ins reais.`
              : 'Você ainda não iniciou um ciclo ativo. Quando houver um ciclo arquivado selecionado, o painel mostra o histórico correspondente.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handlePrimaryAction}
            disabled={activeCycle ? !canEditCycle : actionLoading}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-10 py-5 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20',
              activeCycle && canEditCycle
                ? 'brand-gradient text-black hover:scale-[0.98]'
                : activeCycle
                  ? 'cursor-not-allowed border border-[#262626] bg-[#0a0a0a] text-neutral-600 shadow-none'
                  : 'brand-gradient text-black hover:scale-[0.98]'
            )}
          >
            <Plus className="h-5 w-5" />
            {actionLoading && !activeCycle ? <Loader2 className="h-5 w-5 animate-spin" /> : primaryActionLabel}
          </button>
          <button
            onClick={() => fetchPlan()}
            className="rounded-2xl border border-[#262626] px-8 py-5 text-[10px] font-black uppercase tracking-widest text-neutral-300 transition-colors hover:border-emerald-500 hover:text-white"
          >
            Atualizar
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-[40px] border border-[#262626] bg-[#0d0d0d] p-8 shadow-2xl">
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Semana atual</p>
          <div className="flex items-end justify-between gap-4">
            <span className="whitespace-nowrap text-5xl font-black italic uppercase tracking-tighter">
              {String(displayWeek).padStart(2, '0')} / 12
            </span>
            <span className="text-xs font-mono text-emerald-400">
              {Math.round((displayWeek / 12) * 100)}%
            </span>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full border border-[#262626] bg-[#0a0a0a] p-0.5">
            <div className="h-full rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(62,207,142,0.3)]" style={{ width: `${(displayWeek / 12) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-[40px] border border-[#262626] bg-[#0d0d0d] p-8 shadow-2xl">
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Score semanal</p>
          <div className="flex items-end justify-between gap-4">
            <span className="stat-huge leading-[0.75]">{detailSummary.weeklyScore.toFixed(0)}</span>
            <span className="text-xl font-black uppercase tracking-tighter text-emerald-400">%</span>
          </div>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
            {detailSummary.completedToday}/{detailSummary.tasksDueToday} tarefas de hoje concluídas
          </p>
        </div>

        <div className="rounded-[40px] border border-[#262626] bg-[#050505] p-8 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#262626] bg-[#141414]">
              <Calendar className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Score acumulado</p>
              <p className="text-xl font-black italic uppercase tracking-tighter">{detailSummary.cycleScore}% executado</p>
              <p className="mt-1 text-[10px] font-mono uppercase text-emerald-500">
                {detailSummary.totalGoals} objetivos · {detailSummary.totalTactics} táticas · {detailSummary.totalTasks} tarefas
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[40px] border border-[#262626] bg-[#0a0a0a] p-8 shadow-2xl">
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Cap de objetivos</p>
          <div className="flex items-end justify-between gap-4">
            <span className="text-5xl font-black italic uppercase tracking-tighter">{goals.length}/3</span>
            <span className={cn('text-[10px] font-black uppercase tracking-[0.2em]', goalLimitReached ? 'text-rose-300' : 'text-emerald-300')}>
              {goalLimitReached ? 'limite atingido' : `${3 - goals.length} vagas`}
            </span>
          </div>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
            {goalLimitReached ? 'Não é possível criar um quarto objetivo neste ciclo.' : 'A UI bloqueia o quarto objetivo e a regra persiste com o mesmo limite.'}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 rounded-[40px] border border-[#262626] bg-[#0b0b0b] p-8 shadow-2xl">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Histórico de score</p>
              <h2 className="mt-2 text-3xl font-black italic uppercase tracking-tighter">Linha do ciclo</h2>
            </div>
            <p className="max-w-md text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
              Semanas futuras aparecem em cinza; o gráfico abaixo é derivado dos check-ins reais do ciclo selecionado.
            </p>
          </div>
          {historyChartData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historyChartData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#737373', fontSize: 11, fontWeight: 900 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#737373', fontSize: 11, fontWeight: 900 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: 'rgba(62, 207, 142, 0.08)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const entry = payload[0].payload as any;
                      return (
                        <div className="rounded-2xl border border-[#262626] bg-black/95 p-4 shadow-2xl">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{label}</p>
                          <p className="mt-2 text-2xl font-black italic uppercase text-white">
                            {entry.rawScore === null ? 'Sem fechamento' : `${entry.rawScore}%`}
                          </p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                            {entry.completed}/{entry.expected} check-ins esperados
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="score" radius={[12, 12, 0, 0]}>
                    {historyChartData.map((entry) => (
                      <Cell
                        key={entry.label}
                        fill={entry.rawScore === null ? '#292929' : entry.current ? '#3ecf8e' : '#1f7a57'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-[32px] border border-dashed border-[#262626] bg-[#080808] p-10 text-center">
              <LineChart className="mx-auto mb-4 h-12 w-12 text-neutral-700" />
              <p className="text-sm font-black uppercase tracking-[0.2em] text-neutral-500">Sem histórico disponível</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
                Selecione um ciclo arquivado ou crie o primeiro ciclo ativo para começar a registrar a linha semanal.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 rounded-[40px] border border-[#262626] bg-[#050505] p-8 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Arquivos</p>
              <h2 className="mt-2 text-2xl font-black italic uppercase tracking-tighter">Ciclos arquivados</h2>
            </div>
            <Archive className="h-6 w-6 text-neutral-700" />
          </div>

          {archiveError && (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-100">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Falha nos arquivos</p>
              <p className="mt-1 text-sm">{archiveError}</p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {archiveLoading && archivedCycles.length === 0 ? (
              <div className="space-y-3">
                <div className="h-16 animate-pulse rounded-3xl bg-white/5" />
                <div className="h-16 animate-pulse rounded-3xl bg-white/5" />
              </div>
            ) : archivedCycles.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-[#1a1a1a] bg-black/30 p-5">
                <CircleSlash2 className="mb-3 h-6 w-6 text-neutral-700" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Sem ciclos arquivados</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
                  O histórico aparecerá aqui quando houver ciclos concluídos no Supabase de dev.
                </p>
              </div>
            ) : (
              archivedCycles.map((cycle) => {
                const isSelected = selectedArchivedCycleId === cycle.id;
                return (
                  <button
                    key={cycle.id}
                    type="button"
                    onClick={() => void loadArchivedCycle(cycle.id)}
                    className={cn(
                      'w-full rounded-[28px] border p-4 text-left transition-all',
                      isSelected
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : 'border-[#1a1a1a] bg-black/30 hover:border-emerald-500/20'
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                          Ciclo #{cycle.number}
                        </p>
                        <p className="mt-1 text-sm font-black uppercase tracking-tight text-white">
                          {cycle.end_date ? `Encerrado em ${format(new Date(cycle.end_date), 'dd/MM/yyyy')}` : format(new Date(cycle.start_date), 'dd/MM/yyyy')}
                        </p>
                      </div>
                      <span className="rounded-full border border-[#262626] px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        {cycle.status}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selectedArchivedView ? (
            <div className="mt-6 rounded-[28px] border border-[#1a1a1a] bg-black/30 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Pré-visualização</p>
              <p className="mt-2 text-2xl font-black italic uppercase tracking-tighter text-white">
                #{selectedArchivedView.cycle.number}
              </p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                {selectedArchivedView.summary.cycleScore}% executado · {selectedArchivedView.summary.weeklyScore}% semanal
              </p>
              <div className="mt-4 space-y-2">
                {selectedArchivedView.goals.slice(0, 3).map((goal: any) => (
                  <div key={goal.id} className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Objetivo</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-tight text-white">{goal.title}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[28px] border border-dashed border-[#1a1a1a] bg-black/30 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Selecione um arquivo</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
                O painel lateral carrega o resumo do ciclo arquivado selecionado.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Visão semanal</p>
            <h2 className="mt-2 text-3xl font-black italic uppercase tracking-tighter">Agrupado por data</h2>
          </div>
          <p className="max-w-lg text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
            A lista abaixo mostra as tarefas da semana de referência do ciclo selecionado separadas por dia. Em ciclo ativo, apenas hoje fica editável.
          </p>
        </div>

        {weeklyView.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-7">
            {weeklyView.map((day) => (
              <div
                key={day.dateKey}
                className={cn(
                  'rounded-[30px] border p-4',
                  day.isToday ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-[#262626] bg-[#090909]'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{day.label}</p>
                    <p className="mt-1 text-lg font-black italic uppercase tracking-tight text-white">{day.shortLabel}</p>
                  </div>
                  <span className="rounded-full border border-[#262626] px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
                    {day.doneCount}/{day.dueCount}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {day.tasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#262626] bg-black/30 p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Sem tarefas</p>
                    </div>
                  ) : (
                    day.tasks.map((task) => (
                      <div key={`${day.dateKey}-${task.id}`} className="rounded-2xl border border-[#1a1a1a] bg-black/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                              {formatFrequencyLabel(task.frequency)}
                            </p>
                            <p className="mt-1 text-sm font-black uppercase tracking-tight text-white">{task.title}</p>
                            {(task.goalTitle || task.tacticTitle) && (
                              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
                                {task.goalTitle}
                                {task.tacticTitle ? ` · ${task.tacticTitle}` : ''}
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              'rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em]',
                              task.completed
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                : day.isToday
                                  ? 'border-[#262626] text-neutral-300'
                                  : 'border-[#262626] text-neutral-600'
                            )}
                          >
                            {task.completed ? 'feito' : day.isToday ? 'hoje' : 'previsto'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[40px] border border-dashed border-[#262626] bg-[#0b0b0b] p-12 text-center">
            <Target className="mx-auto mb-6 h-16 w-16 text-neutral-800" />
            <h3 className="mb-3 text-3xl font-black italic uppercase tracking-tighter">Sem visão semanal</h3>
            <p className="mx-auto mb-8 max-w-md text-[10px] font-bold uppercase leading-loose tracking-widest text-neutral-500">
              Selecione um ciclo ou crie o primeiro ciclo ativo para ver as tarefas agrupadas por data.
            </p>
            {!activeCycle && (
              <button
                onClick={handleCreateCycle}
                disabled={actionLoading}
                className="brand-gradient rounded-2xl px-10 py-5 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:scale-[0.98]"
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Iniciar Ciclo 12WY'}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Objetivos</p>
            <h2 className="mt-2 text-3xl font-black italic uppercase tracking-tighter">
              {activeCycle ? 'Ciclo ativo' : 'Somente leitura do arquivo'}
            </h2>
          </div>
          {activeCycle ? (
            <button
              onClick={openGoalModal}
              disabled={!canEditCycle}
              className="rounded-2xl border border-[#262626] px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-300 transition-colors hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {goalLimitReached ? 'Limite 3/3' : '+ Adicionar objetivo'}
            </button>
          ) : null}
        </div>

        {currentGoals.length === 0 ? (
          <div className="rounded-[40px] border border-dashed border-[#262626] bg-[#0b0b0b] p-12 text-center">
            <Target className="mx-auto mb-6 h-16 w-16 text-neutral-800" />
            <h3 className="mb-3 text-3xl font-black italic uppercase tracking-tighter">
              {activeCycle ? 'Sem objetivos ainda' : 'Nenhum arquivo selecionado'}
            </h3>
            <p className="mx-auto mb-8 max-w-md text-[10px] font-bold uppercase leading-loose tracking-widest text-neutral-500">
              {activeCycle
                ? 'Comece definindo o primeiro objetivo do ciclo. Depois você adiciona táticas, tarefas e check-ins.'
                : 'Escolha um ciclo arquivado no painel lateral para consultar o conteúdo histórico.'}
            </p>
            {activeCycle && (
              <button
                onClick={openGoalModal}
                disabled={!canEditCycle}
                className="brand-gradient rounded-2xl px-10 py-5 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {goalLimitReached ? 'Limite 3/3' : 'Criar Primeiro Objetivo'}
              </button>
            )}
          </div>
        ) : (
          currentGoals.map((goal, idx) => (
            <GoalAccordion
              key={goal.id}
              index={idx}
              expanded={expandedGoal === goal.id}
              onToggle={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
              goal={goal}
              onAddTactic={() => openTacticModal(goal.id)}
              onAddTask={openTaskModal}
              onToggleTask={handleToggleTask}
              actionLoading={actionLoading}
              readOnly={currentGoalsReadOnly}
            />
          ))
        )}
      </section>

      <AnimatePresence>
        {isAddingGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-md rounded-[32px] border border-[#262626] bg-[#050505] p-10"
            >
              <button onClick={closeModals} className="absolute right-8 top-8 text-neutral-600 transition-colors hover:text-white">
                <X className="h-6 w-6" />
              </button>
              <h2 className="mb-2 text-4xl font-black italic uppercase leading-none tracking-tighter">
                Novo
                <br />
                Objetivo
              </h2>
              <p className="mb-10 text-xs font-bold uppercase tracking-widest text-neutral-500">
                Defina a meta, indicador e prazo do ciclo.
              </p>
              <p className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                {goals.length}/3 objetivos cadastrados
              </p>
              <form onSubmit={handleAddGoal} className="space-y-4">
                <input
                  autoFocus
                  required
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-sm font-black uppercase tracking-widest outline-none transition-all placeholder:text-neutral-800 focus:border-emerald-500"
                  placeholder="EX: CONSOLIDAR PRESENÇA DIGITAL"
                />
                <textarea
                  value={newGoalDescription}
                  onChange={(e) => setNewGoalDescription(e.target.value)}
                  className="min-h-[110px] w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-xs font-bold uppercase tracking-widest outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                  placeholder="DESCRIÇÃO DO OBJETIVO"
                />
                <input
                  value={newGoalIndicator}
                  onChange={(e) => setNewGoalIndicator(e.target.value)}
                  className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-xs font-black uppercase tracking-widest outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                  placeholder="INDICADOR EX.: LEADS/MÊS"
                />
                <input
                  type="date"
                  value={newGoalDeadline}
                  onChange={(e) => setNewGoalDeadline(e.target.value)}
                  className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-xs font-black uppercase tracking-widest outline-none focus:border-emerald-500"
                />
                <button
                  disabled={actionLoading || goalLimitReached}
                  className="brand-gradient w-full rounded-[24px] py-6 text-xs font-black uppercase tracking-[0.2em] text-black shadow-xl shadow-emerald-500/20"
                >
                  {actionLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : goalLimitReached ? 'Limite de 3 objetivos' : 'Criar Objetivo'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingTactic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-md rounded-[32px] border border-[#262626] bg-[#050505] p-10"
            >
              <button onClick={closeModals} className="absolute right-8 top-8 text-neutral-600 transition-colors hover:text-white">
                <X className="h-6 w-6" />
              </button>
              <h2 className="mb-2 text-4xl font-black italic uppercase leading-none tracking-tighter">
                Nova
                <br />
                Tática
              </h2>
              <p className="mb-10 text-xs font-bold uppercase tracking-widest text-neutral-500">
                A tática organiza a execução. As tarefas ficam dentro dela.
              </p>
              <form onSubmit={handleAddTactic} className="mt-10 space-y-4">
                <input
                  autoFocus
                  required
                  value={newTacticTitle}
                  onChange={(e) => setNewTacticTitle(e.target.value)}
                  className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-sm font-black uppercase tracking-widest outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                  placeholder="EX: PROSPECÇÃO ATIVA"
                />
                <textarea
                  value={newTacticDescription}
                  onChange={(e) => setNewTacticDescription(e.target.value)}
                  className="min-h-[110px] w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-xs font-bold uppercase tracking-widest outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                  placeholder="DESCRIÇÃO DA TÁTICA"
                />
                <button
                  disabled={actionLoading || !activeCycle}
                  className="brand-gradient w-full rounded-[24px] py-6 text-xs font-black uppercase tracking-[0.2em] text-black"
                >
                  {actionLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Confirmar Tática'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-md rounded-[32px] border border-[#262626] bg-[#050505] p-10"
            >
              <button onClick={closeModals} className="absolute right-8 top-8 text-neutral-600 transition-colors hover:text-white">
                <X className="h-6 w-6" />
              </button>
              <h2 className="mb-2 text-4xl font-black italic uppercase leading-none tracking-tighter">
                Nova
                <br />
                Tarefa
              </h2>
              <p className="mb-10 text-xs font-bold uppercase tracking-widest text-neutral-500">
                Registre a ação concreta e os check-ins.
              </p>
              <form onSubmit={handleAddTask} className="space-y-4">
                <input
                  autoFocus
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-sm font-black uppercase tracking-widest outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                  placeholder="EX: LIGAR PARA 10 LEADS"
                />
                <select
                  value={newTaskFrequency}
                  onChange={(e) => setNewTaskFrequency(e.target.value as 'daily' | 'specific_days' | 'weekly')}
                  className="w-full appearance-none rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-xs font-black uppercase tracking-widest outline-none focus:border-emerald-500"
                >
                  <option value="daily">DIÁRIO</option>
                  <option value="specific_days">DIAS ESPECÍFICOS</option>
                  <option value="weekly">SEMANAL</option>
                </select>
                <input
                  value={newTaskSpecificDays}
                  onChange={(e) => setNewTaskSpecificDays(e.target.value)}
                  disabled={newTaskFrequency !== 'specific_days'}
                  className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-xs font-black uppercase tracking-widest outline-none placeholder:text-neutral-800 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                  placeholder="DIAS 0,1,2,3,4,5,6"
                />
                {newTaskFrequency === 'specific_days' && (
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
                    {parseSpecificDays(newTaskSpecificDays).length > 0
                      ? `Dias selecionados: ${formatSpecificDays(parseSpecificDays(newTaskSpecificDays))}`
                      : 'Informe um ou mais dias de 0 a 6 separados por vírgula.'}
                  </p>
                )}
                <button
                  disabled={actionLoading || !activeCycle}
                  className="brand-gradient w-full rounded-[24px] py-6 text-xs font-black uppercase tracking-[0.2em] text-black"
                >
                  {actionLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Confirmar Tarefa'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GoalAccordion({
  index,
  expanded,
  onToggle,
  goal,
  onAddTactic,
  onAddTask,
  onToggleTask,
  actionLoading,
  readOnly = false,
}: any) {
  return (
    <div className="overflow-hidden rounded-[40px] border border-[#262626] bg-[#0d0d0d] shadow-2xl transition-all hover:bg-[#111111]">
      <div onClick={onToggle} className="group flex cursor-pointer items-center justify-between p-10">
        <div className="flex items-center gap-8">
          <div className="pointer-events-none select-none text-[#141414] transition-colors group-hover:text-emerald-500/50 stat-huge">
            {(index + 1).toString().padStart(2, '0')}
          </div>
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-[#262626] bg-[#141414] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                Objetivo
              </span>
              <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                {goal.progress}% executado
              </span>
              <span className={cn('rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest', goalStatusClasses(goal.status))}>
                {formatGoalStatus(goal.status)}
              </span>
              {goal.indicator && (
                <span className="rounded-lg border border-[#262626] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                  {goal.indicator}
                </span>
              )}
            </div>
            <h3 className="mb-2 text-3xl font-black italic uppercase leading-tight tracking-tighter transition-colors group-hover:text-emerald-400">
              {goal.title}
            </h3>
            {goal.description && <p className="max-w-2xl text-xs font-bold uppercase tracking-widest text-neutral-500">{goal.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {goal.deadline && (
                <span className="rounded-full border border-[#262626] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                  Prazo {format(new Date(goal.deadline), 'dd/MM/yyyy')}
                </span>
              )}
              <span className="rounded-full border border-[#262626] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                {goal.tactics.length} táticas · {goal.totalTasks} tarefas
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex flex-col items-end mr-8">
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-neutral-600">SCORE EXEC</p>
            <p className="text-2xl font-black italic tracking-tighter text-emerald-400">{goal.progress}%</p>
          </div>
          {expanded ? <ChevronUp className="h-10 w-10 text-emerald-500" /> : <ChevronDown className="h-10 w-10 text-neutral-700 transition-colors group-hover:text-white" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#1a1a1a] px-10 pb-12"
          >
            {!readOnly && (
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTactic();
                  }}
                  className="rounded-2xl border border-[#262626] px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-300 transition-colors hover:border-emerald-500 hover:text-white"
                >
                  + Adicionar Tática
                </button>
              </div>
            )}

            <div className="mt-8 space-y-6">
              {goal.tactics.length === 0 ? (
                <div className="rounded-[32px] border border-dashed border-[#262626] bg-[#0a0a0a] p-8 text-center">
                  <p className="mb-2 text-sm font-black uppercase tracking-widest text-neutral-500">
                    {readOnly ? 'Sem táticas registradas' : 'Sem táticas ainda'}
                  </p>
                  <p className="mx-auto mb-6 max-w-md text-[10px] font-bold uppercase leading-loose tracking-widest text-neutral-600">
                    {readOnly
                      ? 'Este ciclo está em modo de leitura e não permite alterações.'
                      : 'Crie a primeira tática para ligar o objetivo às tarefas reais do ciclo.'}
                  </p>
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddTactic();
                      }}
                      className="brand-gradient rounded-2xl px-8 py-4 text-[10px] font-black uppercase tracking-widest text-black"
                    >
                      Criar Tática
                    </button>
                  )}
                </div>
              ) : (
                goal.tactics.map((tactic: any) => (
                  <div key={tactic.id} className="rounded-[32px] border border-[#262626] bg-[#0a0a0a] p-8 transition-all hover:border-emerald-500/30">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-lg border border-[#262626] bg-[#141414] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                            Tática
                          </span>
                          <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                            {tactic.progress}% executado
                          </span>
                          {tactic.frequency && (
                            <span className="rounded-lg border border-[#262626] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                              {formatFrequencyLabel(tactic.frequency)}
                            </span>
                          )}
                        </div>
                        <h5 className="text-xl font-black uppercase tracking-tight leading-tight">{tactic.title}</h5>
                        {tactic.description && <p className="mt-3 text-xs font-bold uppercase tracking-widest text-neutral-500">{tactic.description}</p>}
                      </div>
                      {!readOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddTask(tactic.id);
                          }}
                          className="rounded-2xl border border-[#262626] px-5 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-300 transition-colors hover:border-emerald-500 hover:text-white"
                        >
                          + Adicionar Tarefa
                        </button>
                      )}
                    </div>

                    <div className="mt-6 h-2 w-full overflow-hidden rounded-full border border-[#262626] bg-[#141414] p-0.5">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${tactic.progress}%` }} />
                    </div>

                    <div className="mt-6 space-y-3">
                      {tactic.tasks.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[#262626] bg-[#080808] p-5 text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Sem tarefas nesta tática</p>
                        </div>
                      ) : (
                        tactic.tasks.map((task: any) => (
                          <div key={task.id} className="rounded-2xl border border-[#262626] bg-[#090909] p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="max-w-2xl">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                  <span className="rounded-md border border-[#262626] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                                    {formatFrequencyLabel(task.frequency)}
                                  </span>
                                  <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest ${task.dueToday ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border border-[#262626] text-neutral-600'}`}>
                                    {task.dueToday ? 'HOJE' : 'NÃO DUE HOJE'}
                                  </span>
                                  <span className="rounded-md border border-[#262626] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                                    {task.progress}%
                                  </span>
                                </div>
                                <h6 className="text-base font-black uppercase tracking-tight">{task.title}</h6>
                                {task.frequency === 'specific_days' && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {specificDaysList(task.specific_days).map((dayLabel: string) => (
                                      <span
                                        key={`${task.id}-${dayLabel}`}
                                        className="rounded-full border border-[#262626] bg-black/40 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500"
                                      >
                                        {dayLabel}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                                  {readOnly
                                    ? 'Ciclo arquivado'
                                    : task.completedToday
                                      ? 'Check-in de hoje concluído'
                                      : 'Check-in de hoje pendente'}
                                </p>
                              </div>
                              {!readOnly && (
                                <button
                                  disabled={actionLoading}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleTask(task.id, task.completedToday);
                                  }}
                                  className={`rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest transition-colors ${
                                    task.completedToday
                                      ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                      : 'border border-[#262626] text-neutral-300 hover:border-emerald-500 hover:text-white'
                                  }`}
                                >
                                  {task.completedToday ? 'Desmarcar hoje' : 'Marcar hoje'}
                                </button>
                              )}
                            </div>
                            <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-[#262626] bg-[#141414] p-0.5">
                              <div className="h-full rounded-full bg-neutral-500 transition-all duration-700" style={{ width: `${task.progress}%` }} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest text-neutral-600">
                              <span>Semana: {task.weeklyProgress}%</span>
                              <span>Hoje: {task.completedToday ? 'feito' : 'pendente'}</span>
                              <span>Check-ins: {task.checkins.length}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
