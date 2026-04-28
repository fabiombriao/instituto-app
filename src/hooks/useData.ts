import { useEffect, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { canViewFinancialROI } from '../lib/roiAccess';
import {
  ActiveCycleState,
  ArchivedCycle,
  Cycle,
  Goal,
  Habit,
  HabitCheckin,
  PlanGoal,
  PlanSummary,
  PlanTask,
  PlanTactic,
  ROIResult,
  ROIBaseline,
  Program,
  Profile,
  MonitorAssignmentStats,
  Task,
  TaskCheckin,
  Tatic,
  WeeklyScore,
  WeeklyTaskGroup,
  WeeklyTaskItem,
  UserInvite,
  Turma,
  Enrollment,
} from '../types';
import { useAuth } from '../context/AuthContext';

const FETCH_TIMEOUT_MS = 8000;
const HABIT_HEATMAP_DAYS = 84;
const HABIT_STREAK_LOOKBACK_DAYS = 365;

function createLoadingFinisher(setLoading: (value: boolean) => void) {
  let settled = false;

  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true;
      setLoading(false);
    }
  }, FETCH_TIMEOUT_MS);

  return () => {
    if (settled) return false;
    settled = true;
    clearTimeout(timeout);
    setLoading(false);
    return true;
  };
}

function toHabitDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function parseHabitDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getActiveHabits(habits: (Habit & { checkins: HabitCheckin[] })[]) {
  return habits.filter((habit) => !habit.is_paused);
}

function getHabitCheckinsMap(habit: Habit & { checkins: HabitCheckin[] }) {
  return new Map(
    [...(habit.checkins ?? [])]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((checkin) => [checkin.date, checkin.status] as const)
  );
}

function getHabitSpecificDays(habit: Habit & { checkins: HabitCheckin[] }) {
  if (!Array.isArray(habit.specific_days)) return [];
  return habit.specific_days
    .filter((day) => Number.isInteger(day))
    .map((day) => ((day % 7) + 7) % 7);
}

function getHabitScheduleWeekday(habit: Habit & { checkins: HabitCheckin[] }) {
  const createdAt = habit.created_at ? new Date(habit.created_at) : new Date();
  return createdAt.getDay();
}

export function isHabitDueOnDate(habit: Habit & { checkins: HabitCheckin[] }, referenceDate: Date) {
  const frequency = habit.frequency ?? 'daily';

  if (frequency === 'specific_days') {
    return getHabitSpecificDays(habit).includes(referenceDate.getDay());
  }

  if (frequency === 'weekly') {
    return referenceDate.getDay() === getHabitScheduleWeekday(habit);
  }

  return true;
}

export function calculateHabitStreak(habit: Habit & { checkins: HabitCheckin[] }, referenceDate = new Date()) {
  if (habit.is_paused) return 0;

  const resetDate = habit.streak_reset_on ? parseHabitDateKey(habit.streak_reset_on) : null;
  const checkinsByDate = getHabitCheckinsMap(habit);

  let streak = 0;
  for (let day = 0; day < HABIT_STREAK_LOOKBACK_DAYS; day += 1) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - day);
    if (resetDate && date <= resetDate) {
      break;
    }

    if (!isHabitDueOnDate(habit, date)) {
      continue;
    }

    const dateKey = toHabitDateKey(date);
    if (checkinsByDate.get(dateKey) === true) {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

export function buildHabitHeatmap(
  habit: Habit & { checkins: HabitCheckin[] },
  anchorDate = new Date(),
  windowDays = HABIT_HEATMAP_DAYS
) {
  const checkinsByDate = getHabitCheckinsMap(habit);

  return [...Array(windowDays)].map((_, index) => {
    const date = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - (windowDays - 1 - index));
    const dateKey = toHabitDateKey(date);
    const due = isHabitDueOnDate(habit, date);
    const status = checkinsByDate.get(dateKey);

    return {
      date,
      dateKey,
      due,
      status: due ? (status === true ? 'done' : 'missed') : 'not_due',
      label: format(date, 'dd/MM/yyyy'),
      weekday: date.getDay(),
      isAnchor: dateKey === toHabitDateKey(anchorDate),
    };
  });
}

export function buildHabitConsistency(
  habit: Habit & { checkins: HabitCheckin[] },
  anchorDate = new Date(),
  windowDays = HABIT_HEATMAP_DAYS
) {
  const checkinsByDate = getHabitCheckinsMap(habit);
  let dueDays = 0;
  let completedDays = 0;

  for (let day = 0; day < windowDays; day += 1) {
    const date = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - day);
    if (!isHabitDueOnDate(habit, date)) {
      continue;
    }

    dueDays += 1;
    const dateKey = toHabitDateKey(date);
    if (checkinsByDate.get(dateKey) === true) {
      completedDays += 1;
    }
  }

  return dueDays > 0 ? Math.round((completedDays / dueDays) * 100) : 0;
}

function getCurrentHabitStreak(habits: (Habit & { checkins: HabitCheckin[] })[], referenceDate = new Date()) {
  return getActiveHabits(habits).reduce((maxStreak, habit) => {
    const habitStreak = calculateHabitStreak(habit, referenceDate);
    return Math.max(maxStreak, habitStreak);
  }, 0);
}

export function isProgramArchived(program: Pick<Program, 'status' | 'archived_at'>) {
  return program.status === 'archived' || Boolean(program.archived_at);
}

export function isProfileDisabled(profile: Pick<Profile, 'disabled_at'>) {
  return Boolean(profile.disabled_at);
}

export function getMonitorRemainingSlots(limit: number | null | undefined, assignedCount: number) {
  if (limit == null) return null;
  return Math.max(limit - assignedCount, 0);
}

export function buildMonitorSummaryMap(rows: MonitorAssignmentStats[]) {
  return rows.reduce<Record<string, MonitorAssignmentStats>>((acc, row) => {
    acc[row.monitor_id] = row;
    return acc;
  }, {});
}

export function useHabits() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<(Habit & { checkins: HabitCheckin[] })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHabits = async () => {
    if (!user) {
      console.log('useHabits: No user, setting loading false');
      setLoading(false);
      return;
    }
    setLoading(true);
    const finishLoading = createLoadingFinisher(setLoading);
    try {
      console.log('useHabits: Fetching for user', user.id);
      const { data: habitsData, error } = await supabase
        .from('habits')
        .select('*, habit_checkins(*)')
        .eq('aluno_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('useHabits: Supabase error', error);
        throw error;
      }
      
      if (habitsData) {
        setHabits(habitsData.map((h: any) => ({
          ...h,
          checkins: [...(h.habit_checkins || [])].sort((left: HabitCheckin, right: HabitCheckin) => left.date.localeCompare(right.date)),
        })));
      }
    } catch (err) {
      console.error('Error fetching habits:', err);
    } finally {
      finishLoading();
    }
  };

  useEffect(() => {
    fetchHabits();
  }, [user]);

  const markHabitCheckin = async (habitId: string, date: string, status = true) => {
    const habit = habits.find((candidate) => candidate.id === habitId);
    if (habit?.is_paused) {
      return new Error('Hábito pausado. Retome antes de registrar novos check-ins.');
    }

    const { error } = await supabase
      .from('habit_checkins')
      .upsert({ habit_id: habitId, date, status }, { onConflict: 'habit_id,date' });
    
    if (!error) fetchHabits();
    return error;
  };

  const toggleHabit = async (habitId: string, date: string, currentStatus: boolean) => {
    return markHabitCheckin(habitId, date, !currentStatus);
  };

  const toggleHabitPause = async (habitId: string, paused: boolean) => {
    const updatePayload: Record<string, unknown> = {
      is_paused: paused,
    };

    if (paused) {
      updatePayload.streak_reset_on = toHabitDateKey(new Date());
    }

    const { error } = await supabase
      .from('habits')
      .update(updatePayload)
      .eq('id', habitId);
    
    if (!error) fetchHabits();
    return error;
  };

  const addHabit = async (name: string) => {
    const { error } = await supabase
      .from('habits')
      .insert({
        aluno_id: user?.id,
        name,
        type: 'build',
        frequency: 'daily',
        specific_days: [],
        target_days: 7,
        is_paused: false,
        streak_reset_on: null,
      });

    if (!error) fetchHabits();
    return error;
  };

  const getStats = () => {
    const activeHabits = getActiveHabits(habits);
    if (activeHabits.length === 0) {
      return {
        avgPerformance: 0,
        totalStreaks: 0,
        currentStreak: 0,
        activeHabits: 0,
        pausedHabits: habits.length,
        todayDueHabits: 0,
        todayCompletedHabits: 0,
        last7CompletionRate: 0,
      };
    }

    const today = new Date();
    const last7 = [...Array(7)].map((_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
    let totalPossible = 0;
    let totalCompleted = 0;
    let todayDueHabits = 0;
    let todayCompletedHabits = 0;

    activeHabits.forEach((habit) => {
      last7.forEach((date) => {
        if (!isHabitDueOnDate(habit, date)) {
          return;
        }

        totalPossible += 1;
        const dateKey = toHabitDateKey(date);
        const hasCheckin = habit.checkins.some((checkin) => checkin.date === dateKey && checkin.status);
        if (hasCheckin) {
          totalCompleted += 1;
        }

        if (dateKey === toHabitDateKey(today)) {
          todayDueHabits += 1;
          if (hasCheckin) {
            todayCompletedHabits += 1;
          }
        }
      });
    });

    const currentStreak = getCurrentHabitStreak(habits, today);
    const totalStreaks = activeHabits.reduce((sum, habit) => sum + calculateHabitStreak(habit, today), 0);
    const performance = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

    return {
      avgPerformance: performance,
      totalStreaks,
      currentStreak,
      activeHabits: activeHabits.length,
      pausedHabits: habits.length - activeHabits.length,
      todayDueHabits,
      todayCompletedHabits,
      last7CompletionRate: performance,
    };
  };

  return { habits, loading, fetchHabits, toggleHabit, markHabitCheckin, toggleHabitPause, addHabit, stats: getStats() };
}

export function useAdminData() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [weeklyScores, setWeeklyScores] = useState<WeeklyScore[]>([]);
  const [userInvites, setUserInvites] = useState<UserInvite[]>([]);
  const [monitorSummaries, setMonitorSummaries] = useState<MonitorAssignmentStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    if (!profile || (profile.role !== 'SUPER_ADMIN' && profile.role !== 'admin')) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const finishLoading = createLoadingFinisher(setLoading);
    try {
      const [
        profilesRes,
        programsRes,
        turmasRes,
        enrollmentsRes,
        cyclesRes,
        weeklyScoresRes,
        invitesRes,
        monitorSummaryRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('programs').select('*').order('created_at', { ascending: false }),
        supabase.from('turmas').select('*').order('created_at', { ascending: false }),
        supabase.from('enrollments').select('*').order('created_at', { ascending: false }),
        supabase.from('cycles').select('*').order('created_at', { ascending: false }),
        supabase.from('weekly_scores').select('*').order('created_at', { ascending: false }),
        supabase.from('user_invites').select('*').order('created_at', { ascending: false }),
        supabase.rpc('get_monitor_assignment_summary'),
      ]);

      const queryError = profilesRes.error || programsRes.error || turmasRes.error || enrollmentsRes.error || cyclesRes.error || weeklyScoresRes.error;
      if (queryError) throw queryError;

      setUsers((profilesRes.data ?? []) as Profile[]);
      setPrograms((programsRes.data ?? []) as Program[]);
      setTurmas((turmasRes.data ?? []) as Turma[]);
      setEnrollments((enrollmentsRes.data ?? []) as Enrollment[]);
      setCycles((cyclesRes.data ?? []) as Cycle[]);
      setWeeklyScores((weeklyScoresRes.data ?? []) as WeeklyScore[]);
      setUserInvites((invitesRes.data ?? []) as UserInvite[]);

      if (monitorSummaryRes.error) {
        console.warn('useAdminData: Could not load monitor summaries', monitorSummaryRes.error);
        setMonitorSummaries([]);
      } else {
        setMonitorSummaries((monitorSummaryRes.data ?? []) as MonitorAssignmentStats[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      finishLoading();
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [profile]);

  const updateUserRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.rpc('set_profile_role', {
      p_profile_id: userId,
      p_role: newRole,
    });

    if (!error) fetchUsers();
    return error;
  };

  const toggleUserDisabled = async (userId: string, disabled: boolean) => {
    const { error } = await supabase.rpc('set_profile_disabled_state', {
      p_profile_id: userId,
      p_disabled: disabled,
    });

    if (!error) fetchUsers();
    return error;
  };

  const setUserMonitorLimit = async (userId: string, monitorLimit: number | null) => {
    const { error } = await supabase.rpc('set_profile_monitor_limit', {
      p_profile_id: userId,
      p_monitor_limit: monitorLimit,
    });

    if (!error) fetchUsers();
    return error;
  };

  const createProgram = async (payload: Pick<Program, 'name' | 'description'>) => {
    const { error } = await supabase.from('programs').insert({
      name: payload.name,
      description: payload.description ?? null,
      archived_at: null,
    });

    if (!error) fetchUsers();
    return error;
  };

  const updateProgram = async (programId: string, payload: Partial<Pick<Program, 'name' | 'description' | 'archived_at'>>) => {
    const { error } = await supabase
      .from('programs')
      .update(payload)
      .eq('id', programId);

    if (!error) fetchUsers();
    return error;
  };

  const archiveProgram = async (programId: string, archived: boolean) => {
    const { error } = await supabase.rpc('set_program_archived_state', {
      p_program_id: programId,
      p_archived: archived,
    });

    if (!error) fetchUsers();
    return error;
  };

  const updateTurma = async (
    turmaId: string,
    payload: Partial<Pick<Turma, 'program_id' | 'name' | 'treinador_id' | 'fechamento_dia' | 'fechamento_hora' | 'weeks_count' | 'start_date'>>
  ) => {
    const { error } = await supabase
      .from('turmas')
      .update(payload)
      .eq('id', turmaId);

    if (!error) fetchUsers();
    return error;
  };

  const createUserInvite = async (
    payload: {
      email?: string | null;
      role: UserInvite['role'];
      full_name?: string | null;
      monitor_limit?: number | null;
      invite_type?: UserInvite['invite_type'];
      expires_at?: string | null;
    }
  ) => {
    const { data, error } = await supabase.rpc('create_user_invite', {
      p_email: payload.email ?? null,
      p_full_name: payload.full_name ?? null,
      p_role: payload.role,
      p_monitor_limit: payload.monitor_limit ?? null,
      p_invite_type: payload.invite_type ?? 'email',
      p_expires_at: payload.expires_at ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    });

    if (!error) fetchUsers();
    return { error, data: data as UserInvite | null };
  };

  const acceptUserInvite = async (token: string) => {
    const { data, error } = await supabase.rpc('accept_user_invite', {
      p_token: token,
    });

    if (!error) fetchUsers();
    return { error, data };
  };

  const assignMonitorToEnrollment = async (enrollmentId: string, monitorId: string | null) => {
    const { error } = await supabase.rpc('assign_monitor_to_enrollment', {
      p_enrollment_id: enrollmentId,
      p_monitor_id: monitorId,
    });

    if (!error) fetchUsers();
    return error;
  };

  return {
    users,
    programs,
    turmas,
    enrollments,
    cycles,
    weeklyScores,
    userInvites,
    monitorSummaries,
    loading,
    fetchUsers,
    updateUserRole,
    toggleUserDisabled,
    setUserMonitorLimit,
    createProgram,
    updateProgram,
    archiveProgram,
    updateTurma,
    createUserInvite,
    acceptUserInvite,
    assignMonitorToEnrollment,
  };
}

export function useROI() {
  const { user, profile } = useAuth();
  const [results, setResults] = useState<ROIResult[]>([]);
  const [baseline, setBaseline] = useState<ROIBaseline | null>(null);
  const [baselines, setBaselines] = useState<ROIBaseline[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);

  const [loading, setLoading] = useState(true);
  const hasFinancialAccess = canViewFinancialROI(profile?.role);

  const fetchROI = async () => {
    if (!user) {
      setResults([]);
      setBaseline(null);
      setBaselines([]);
      setActiveCycle(null);
      setLoading(false);
      return;
    }

    if (!hasFinancialAccess) {
      setResults([]);
      setBaseline(null);
      setBaselines([]);
      setActiveCycle(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const finishLoading = createLoadingFinisher(setLoading);
    
    try {
      console.log('useROI: Fetching data for', user.id);
      const [baseData, cycleData] = await Promise.all([
        supabase
          .from('roi_baselines')
          .select('*')
          .eq('aluno_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('cycles')
          .select('*')
          .eq('aluno_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (baseData.error) {
        console.error('useROI: Baseline error', baseData.error);
        throw baseData.error;
      }

      const baselineRows = (baseData.data ?? []) as ROIBaseline[];
      const currentCycle = (cycleData.data ?? null) as Cycle | null;
      const selectedBaseline =
        baselineRows.find((row) => row.cycle_id && row.cycle_id === currentCycle?.id) ??
        baselineRows[0] ??
        null;

      setBaselines(baselineRows);
      setActiveCycle(currentCycle);
      setBaseline(selectedBaseline);

      const resultsQuery = selectedBaseline?.id
        ? supabase.from('roi_results').select('*').eq('baseline_id', selectedBaseline.id).order('date', { ascending: false })
        : supabase.from('roi_results').select('*').eq('aluno_id', user.id).order('date', { ascending: false });

      const { data: resultsData, error: resultsError } = await resultsQuery;
      if (resultsError) {
        console.error('useROI: Results error', resultsError);
        throw resultsError;
      }

      setResults((resultsData ?? []) as ROIResult[]);
    } catch (err) {
      console.error('Error fetching ROI:', err);
    } finally {
      finishLoading();
    }
  };

  useEffect(() => {
    fetchROI();
  }, [user, profile?.role]);

  const addResult = async (amount: number, description: string, date: string) => {
    if (!hasFinancialAccess) {
      return new Error('Seu papel não tem acesso a lançamentos financeiros de ROI.');
    }

    const selectedBaseline = baseline ?? baselines[0] ?? null;
    const cycleId = selectedBaseline?.cycle_id ?? activeCycle?.id ?? null;
    if (!selectedBaseline?.id || !cycleId) {
      return new Error('Configure a baseline e o ciclo antes de lançar um resultado.');
    }

    const { error } = await supabase
      .from('roi_results')
      .insert({
        aluno_id: user?.id,
        baseline_id: selectedBaseline.id,
        program_id: selectedBaseline.program_id ?? null,
        cycle_id: cycleId,
        amount,
        description,
        date,
      });
    
    if (!error) fetchROI();
    return error;
  };

  return { results, baseline, baselines, activeCycle, loading, hasFinancialAccess, addResult, fetchROI };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PLAN_GOAL_LIMIT = 3;

type CyclePlanData = {
  goals: PlanGoal[];
  summary: PlanSummary;
  weeklyScores: WeeklyScore[];
  weeklyTaskGroups: WeeklyTaskGroup[];
  activeCycleState: ActiveCycleState;
};

function createEmptyPlanSummary(): PlanSummary {
  return {
    cycleProgress: 0,
    weeklyScore: 0,
    cycleScore: 0,
    currentWeek: 1,
    totalWeeks: 12,
    weekStart: null,
    weekEnd: null,
    completedToday: 0,
    tasksDueToday: 0,
    totalTasks: 0,
    totalGoals: 0,
    totalTactics: 0,
    goalLimitReached: false,
    remainingGoals: PLAN_GOAL_LIMIT,
  };
}

function createEmptyActiveCycleState(): ActiveCycleState {
  return {
    currentWeek: 0,
    totalWeeks: 12,
    cycleProgress: 0,
    weeklyScore: 0,
    weekStart: null,
    weekEnd: null,
    goalLimitReached: false,
    remainingGoals: PLAN_GOAL_LIMIT,
    isActive: false,
  };
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function minDate(first: Date, second: Date) {
  return first <= second ? first : second;
}

function parseLocalDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getSpecificDays(task: Task) {
  if (!Array.isArray(task.specific_days)) return [];
  return task.specific_days
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day));
}

function isTaskDueOnDate(task: Task, date: Date, cycleStartDay: number) {
  const day = date.getDay();
  const frequency = task.frequency ?? 'daily';
  const specificDays = getSpecificDays(task);

  if (frequency === 'daily') return true;
  if (frequency === 'weekly') return day === cycleStartDay;
  if (frequency === 'specific_days') return specificDays.includes(day);
  return true;
}

function countDueOccurrences(task: Task, start: Date, end: Date, cycleStartDay: number) {
  let count = 0;
  let cursor = new Date(start);

  while (cursor <= end) {
    if (isTaskDueOnDate(task, cursor, cycleStartDay)) count += 1;
    cursor = addDays(cursor, 1);
  }

  return count;
}

function countCompletedOccurrences(task: Task, checkins: TaskCheckin[], start: Date, end: Date, cycleStartDay: number) {
  return checkins.filter((checkin) => {
    const checkinDate = parseLocalDate(checkin.date);
    return Boolean(
      checkin.status === 'done' &&
        checkinDate &&
        checkinDate >= start &&
        checkinDate <= end &&
        isTaskDueOnDate(task, checkinDate, cycleStartDay)
    );
  }).length;
}

function groupBy<T extends Record<string, any>>(items: T[], key: string) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const groupKey = String(item[key]);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {});
}

function getCycleWeekCount(cycleStart: Date, cycleEnd: Date) {
  const safeDiff = Math.max(0, Math.floor((cycleEnd.getTime() - cycleStart.getTime()) / MS_PER_DAY));
  return Math.max(1, Math.min(12, Math.floor(safeDiff / 7) + 1));
}

function getCurrentCycleWeek(cycleStart: Date, referenceDate: Date, totalWeeks: number) {
  const safeDiff = Math.max(0, Math.floor((referenceDate.getTime() - cycleStart.getTime()) / MS_PER_DAY));
  return Math.max(1, Math.min(totalWeeks, Math.floor(safeDiff / 7) + 1));
}

function getWeekWindow(cycleStart: Date, cycleEnd: Date, weekNumber: number) {
  const weekStart = addDays(cycleStart, (weekNumber - 1) * 7);
  const weekEnd = minDate(addDays(weekStart, 6), cycleEnd);
  return { weekStart, weekEnd };
}

function buildWeeklyTaskGroups(tasks: PlanTask[], weekStart: Date, cycleStartDay: number): WeeklyTaskGroup[] {
  return Array.from({ length: 7 }, (_, index) => {
    const dayDate = addDays(weekStart, index);
    const dateKey = toLocalDateKey(dayDate);
    const dueTasks = tasks
      .filter((task) => isTaskDueOnDate(task, dayDate, cycleStartDay))
      .map((task) => {
        const checkin = task.checkins.find((item) => item.date === dateKey);
        return {
          ...task,
          scheduledDate: dateKey,
          dueForDate: true,
          completedForDate: checkin?.status === 'done',
          completedToday: checkin?.status === 'done',
          dueToday: true,
        } satisfies WeeklyTaskItem;
      });

    return {
      date: dateKey,
      dayIndex: dayDate.getDay(),
      label: dayDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      tasks: dueTasks,
      completedCount: dueTasks.filter((task) => task.completedForDate).length,
      dueCount: dueTasks.length,
    };
  });
}

function buildWeeklyScores(
  cycle: Cycle,
  tasks: Task[],
  checkinsByTask: Record<string, TaskCheckin[]>,
  cycleStart: Date,
  cycleEnd: Date,
  cycleStartDay: number,
  visibleWeekCount: number
): WeeklyScore[] {
  return Array.from({ length: visibleWeekCount }, (_, index) => {
    const weekNumber = index + 1;
    const { weekStart, weekEnd } = getWeekWindow(cycleStart, cycleEnd, weekNumber);
    let expected = 0;
    let completed = 0;

    tasks.forEach((task) => {
      const taskCheckins = checkinsByTask[task.id] ?? [];
      expected += countDueOccurrences(task, weekStart, weekEnd, cycleStartDay);
      completed += countCompletedOccurrences(task, taskCheckins, weekStart, weekEnd, cycleStartDay);
    });

    return {
      id: `${cycle.id}-${weekNumber}`,
      aluno_id: String(cycle.aluno_id ?? ''),
      cycle_id: cycle.id,
      cycle_number: cycle.number,
      week_number: weekNumber,
      week_start: toLocalDateKey(weekStart),
      week_end: toLocalDateKey(weekEnd),
      completed_tasks: completed,
      expected_tasks: expected,
      score: expected > 0 ? Math.round((completed / expected) * 100) : 0,
      created_at: new Date().toISOString(),
    };
  });
}

function buildCyclePlanData(
  cycle: Cycle,
  cycleGoals: Goal[],
  tacticsByGoal: Record<string, Tatic[]>,
  tasksByTactic: Record<string, Task[]>,
  checkinsByTask: Record<string, TaskCheckin[]>,
  referenceDate: Date
): CyclePlanData {
  const cycleStart = parseLocalDate(cycle.start_date) ?? referenceDate;
  const cycleEnd = parseLocalDate(cycle.end_date) ?? addDays(cycleStart, 83);
  const effectiveEnd = cycle.status === 'active' ? minDate(referenceDate, cycleEnd) : cycleEnd;
  const cycleStartDay = cycleStart.getDay();
  const totalWeeks = getCycleWeekCount(cycleStart, cycleEnd);
  const currentWeek = getCurrentCycleWeek(cycleStart, effectiveEnd, totalWeeks);
  const currentWeekWindow = getWeekWindow(cycleStart, cycleEnd, currentWeek);
  const todayKey = toLocalDateKey(referenceDate);

  const goals: PlanGoal[] = cycleGoals.map((goal) => {
    const relatedTactics = tacticsByGoal[goal.id] ?? [];
    const enrichedTactics: PlanTactic[] = relatedTactics.map((tactic) => {
      const relatedTasks = tasksByTactic[tactic.id] ?? [];
      const enrichedTasks: PlanTask[] = relatedTasks.map((task) => {
        const taskCheckins = checkinsByTask[task.id] ?? [];
        const expectedOccurrences = countDueOccurrences(task, cycleStart, effectiveEnd, cycleStartDay);
        const completedOccurrences = countCompletedOccurrences(task, taskCheckins, cycleStart, effectiveEnd, cycleStartDay);
        const weeklyExpectedOccurrences = countDueOccurrences(task, currentWeekWindow.weekStart, currentWeekWindow.weekEnd, cycleStartDay);
        const weeklyCompletedOccurrences = countCompletedOccurrences(
          task,
          taskCheckins,
          currentWeekWindow.weekStart,
          currentWeekWindow.weekEnd,
          cycleStartDay
        );

        return {
          ...task,
          checkins: taskCheckins,
          progress: expectedOccurrences > 0 ? Math.round((completedOccurrences / expectedOccurrences) * 100) : 0,
          weeklyProgress: weeklyExpectedOccurrences > 0 ? Math.round((weeklyCompletedOccurrences / weeklyExpectedOccurrences) * 100) : 0,
          completedToday: taskCheckins.some((checkin) => checkin.date === todayKey && checkin.status === 'done'),
          dueToday: isTaskDueOnDate(task, referenceDate, cycleStartDay),
        };
      });

      const totalTasks = enrichedTasks.length;
      return {
        ...tactic,
        tasks: enrichedTasks,
        progress: totalTasks ? Math.round(enrichedTasks.reduce((sum, task) => sum + task.progress, 0) / totalTasks) : 0,
        completedTasks: enrichedTasks.filter((task) => task.completedToday).length,
        totalTasks,
      };
    });

    const totalTactics = enrichedTactics.length;
    return {
      ...goal,
      tactics: enrichedTactics,
      progress: totalTactics ? Math.round(enrichedTactics.reduce((sum, tactic) => sum + tactic.progress, 0) / totalTactics) : 0,
      completedTasks: enrichedTactics.reduce((sum, tactic) => sum + tactic.completedTasks, 0),
      totalTasks: enrichedTactics.reduce((sum, tactic) => sum + tactic.totalTasks, 0),
    };
  });

  const flatTasks = goals.flatMap((goal) => goal.tactics.flatMap((tactic) => tactic.tasks));
  const totalGoals = goals.length;
  const totalTactics = goals.reduce((sum, goal) => sum + goal.tactics.length, 0);
  const totalTasks = goals.reduce((sum, goal) => sum + goal.totalTasks, 0);
  const cycleProgress = totalGoals ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / totalGoals) : 0;
  const weeklyScores = buildWeeklyScores(cycle, flatTasks, checkinsByTask, cycleStart, cycleEnd, cycleStartDay, currentWeek);
  const weeklyScore = weeklyScores[weeklyScores.length - 1]?.score ?? 0;
  const weeklyTaskGroups = cycle.status === 'active' ? buildWeeklyTaskGroups(flatTasks, currentWeekWindow.weekStart, cycleStartDay) : [];
  const completedToday = flatTasks.filter((task) => task.dueToday && task.completedToday).length;
  const tasksDueToday = flatTasks.filter((task) => task.dueToday).length;
  const cycleScore = weeklyScores.length
    ? Math.round(weeklyScores.reduce((sum, item) => sum + item.score, 0) / weeklyScores.length)
    : 0;

  return {
    goals,
    weeklyScores,
    weeklyTaskGroups,
    summary: {
      cycleProgress,
      weeklyScore,
      cycleScore,
      currentWeek,
      totalWeeks,
      weekStart: toLocalDateKey(currentWeekWindow.weekStart),
      weekEnd: toLocalDateKey(currentWeekWindow.weekEnd),
      completedToday,
      tasksDueToday,
      totalTasks,
      totalGoals,
      totalTactics,
      goalLimitReached: totalGoals >= PLAN_GOAL_LIMIT,
      remainingGoals: Math.max(0, PLAN_GOAL_LIMIT - totalGoals),
    },
    activeCycleState: {
      currentWeek,
      totalWeeks,
      cycleProgress,
      weeklyScore,
      weekStart: toLocalDateKey(currentWeekWindow.weekStart),
      weekEnd: toLocalDateKey(currentWeekWindow.weekEnd),
      goalLimitReached: totalGoals >= PLAN_GOAL_LIMIT,
      remainingGoals: Math.max(0, PLAN_GOAL_LIMIT - totalGoals),
      isActive: cycle.status === 'active',
    },
  };
}

function getTotalWeeksForCycle(cycle: Cycle, turmaWeeks?: number | null) {
  const weeks = Number(turmaWeeks ?? 12);
  if (!Number.isFinite(weeks) || weeks <= 0) return 12;
  return Math.max(1, weeks);
}

function getCycleEndDate(cycleStart: Date, totalWeeks: number) {
  return addDays(cycleStart, totalWeeks * 7 - 1);
}

function getCycleWeekNumber(cycleStart: Date, currentDate: Date, totalWeeks: number) {
  const rawWeek = Math.floor(differenceInCalendarDays(currentDate, cycleStart) / 7) + 1;
  return Math.max(1, Math.min(totalWeeks, rawWeek));
}

function getWeekBounds(cycleStart: Date, weekNumber: number, totalWeeks: number) {
  const safeWeek = Math.max(1, Math.min(totalWeeks, weekNumber));
  const start = addDays(cycleStart, (safeWeek - 1) * 7);
  const end = minDate(addDays(start, 6), getCycleEndDate(cycleStart, totalWeeks));
  return { start, end };
}

function formatDateKey(date: Date) {
  return toLocalDateKey(date);
}

function buildTaskMetrics(task: Task, taskCheckins: TaskCheckin[], start: Date, end: Date, cycleStartDay: number) {
  const completed = countCompletedOccurrences(task, taskCheckins, start, end, cycleStartDay);
  const expected = countDueOccurrences(task, start, end, cycleStartDay);
  return {
    completed,
    expected,
    progress: expected > 0 ? Math.round((completed / expected) * 100) : 0,
  };
}

function buildWeeklyAgenda(tasks: PlanTask[], weekStart: Date, weekEnd: Date, cycleStartDay: number): WeeklyTaskGroup[] {
  return Array.from({ length: 7 }, (_, index) => {
    const dayDate = addDays(weekStart, index);
    if (dayDate > weekEnd) {
      return {
        date: formatDateKey(dayDate),
        dayIndex: dayDate.getDay(),
        label: dayDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        tasks: [],
        completedCount: 0,
        dueCount: 0,
      } satisfies WeeklyTaskGroup;
    }

    const dateKey = formatDateKey(dayDate);
    const dueTasks = tasks
      .filter((task) => isTaskDueOnDate(task, dayDate, cycleStartDay))
      .map((task) => {
        const checkin = task.checkins.find((item) => item.date === dateKey);
        return {
          ...task,
          scheduledDate: dateKey,
          dueForDate: true,
          completedForDate: checkin?.status === 'done',
        } satisfies WeeklyTaskItem;
      });

    return {
      date: dateKey,
      dayIndex: dayDate.getDay(),
      label: dayDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      tasks: dueTasks,
      completedCount: dueTasks.filter((task) => task.completedForDate).length,
      dueCount: dueTasks.length,
    } satisfies WeeklyTaskGroup;
  });
}

export function usePlan12WY() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<PlanGoal[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [weeklyScores, setWeeklyScores] = useState<WeeklyScore[]>([]);
  const [weeklyAgenda, setWeeklyAgenda] = useState<WeeklyTaskGroup[]>([]);
  const [summary, setSummary] = useState<PlanSummary>(createEmptyPlanSummary());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resetPlanState = () => {
    setGoals([]);
    setCycles([]);
    setActiveCycle(null);
    setSelectedCycle(null);
    setWeeklyScores([]);
    setWeeklyAgenda([]);
    setSummary(createEmptyPlanSummary());
  };

  const fetchPlan = async () => {
    if (!user) {
      console.log('usePlan12WY: No user');
      resetPlanState();
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const finishLoading = createLoadingFinisher(setLoading);
    setError(null);

    try {
      console.log('usePlan12WY: Fetching cycles for', user.id);
      const { data: cycleListData, error: cyclesError } = await supabase
        .from('cycles')
        .select('*')
        .eq('aluno_id', user.id)
        .order('created_at', { ascending: false });

      if (cyclesError) {
        console.error('usePlan12WY: Cycles error', cyclesError);
        throw cyclesError;
      }

      const cycleList = (cycleListData ?? []) as Cycle[];
      setCycles(cycleList);

      const active = cycleList.find((cycle) => cycle.status === 'active') ?? null;
      setActiveCycle(active);

      const selectedId =
        selectedCycleId && cycleList.some((cycle) => cycle.id === selectedCycleId)
          ? selectedCycleId
          : active?.id ?? cycleList[0]?.id ?? null;

      if (!selectedId) {
        resetPlanState();
        setCycles(cycleList);
        setActiveCycle(active);
        return;
      }

      if (selectedId !== selectedCycleId) {
        setSelectedCycleId(selectedId);
      }

      const selected = cycleList.find((cycle) => cycle.id === selectedId) ?? null;
      setSelectedCycle(selected);

      if (active?.status === 'active') {
        const { data: activeTurma } = active.turma_id
          ? await supabase.from('turmas').select('*').eq('id', active.turma_id).maybeSingle()
          : { data: null, error: null } as any;

        const activeWeeks = getTotalWeeksForCycle(active, (activeTurma as any)?.weeks_count);
        const activeStart = parseLocalDate(active.start_date) ?? new Date();
        const activeEnd = parseLocalDate(active.end_date) ?? getCycleEndDate(activeStart, activeWeeks);
        const todayKey = formatDateKey(new Date());

        if (todayKey > formatDateKey(activeEnd)) {
          const { error: archiveError } = await supabase.rpc('archive_cycle', {
            p_cycle_id: active.id,
          });

          if (archiveError) {
            console.warn('usePlan12WY: Could not archive expired cycle', archiveError);
          }

          await fetchPlan();
          return;
        }
      }

      const targetCycle = selected ?? active ?? null;
      if (!targetCycle) {
        resetPlanState();
        return;
      }

      const { data: targetTurma, error: turmaError } = targetCycle.turma_id
        ? await supabase.from('turmas').select('*').eq('id', targetCycle.turma_id).maybeSingle()
        : { data: null, error: null } as any;

      if (turmaError) {
        console.warn('usePlan12WY: Turma lookup failed', turmaError);
      }

      const totalWeeks = getTotalWeeksForCycle(targetCycle, (targetTurma as any)?.weeks_count);
      const cycleStart = parseLocalDate(targetCycle.start_date) ?? new Date();
      const cycleEnd = parseLocalDate(targetCycle.end_date) ?? getCycleEndDate(cycleStart, totalWeeks);
      const now = new Date();
      const currentWeek = targetCycle.status === 'active'
        ? getCycleWeekNumber(cycleStart, now, totalWeeks)
        : getCycleWeekNumber(cycleStart, cycleEnd, totalWeeks);
      const weekBounds = getWeekBounds(cycleStart, currentWeek, totalWeeks);
      const cycleStartDay = cycleStart.getDay();
      const currentWeekKey = formatDateKey(now);

      console.log('usePlan12WY: Fetching goals for cycle', targetCycle.id);
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .eq('cycle_id', targetCycle.id)
        .order('order', { ascending: true });

      if (goalsError) {
        console.error('usePlan12WY: Goals error', goalsError);
        throw goalsError;
      }

      const baseGoals = (goalsData ?? []) as Goal[];
      const goalIds = baseGoals.map((goal) => goal.id);

      const tacticsResult = goalIds.length
        ? await supabase.from('tactics').select('*').in('goal_id', goalIds).order('order', { ascending: true })
        : ({ data: [], error: null } as any);

      const tacticsData = (tacticsResult.data ?? []) as Tatic[];
      if (tacticsResult.error) {
        console.warn('usePlan12WY: Tactics partial error', tacticsResult.error);
      }

      const tacticIds = tacticsData.map((tactic) => tactic.id);
      const tasksResult = tacticIds.length
        ? await supabase.from('tasks').select('*').in('tactic_id', tacticIds).order('created_at', { ascending: true })
        : ({ data: [], error: null } as any);

      const tasksData = (tasksResult.data ?? []) as Task[];
      if (tasksResult.error) {
        console.warn('usePlan12WY: Tasks partial error', tasksResult.error);
      }

      const taskIds = tasksData.map((task) => task.id);
      const checkinsResult = taskIds.length
        ? await supabase.from('task_checkins').select('*').in('task_id', taskIds).order('date', { ascending: false })
        : ({ data: [], error: null } as any);

      const checkinsData = (checkinsResult.data ?? []) as TaskCheckin[];
      if (checkinsResult.error) {
        console.warn('usePlan12WY: Checkins partial error', checkinsResult.error);
      }

      const warningMessages: string[] = [];
      if (tacticsResult.error || tasksResult.error || checkinsResult.error) {
        warningMessages.push('Parte dos dados do 12WY não carregou integralmente do Supabase de dev. Mostrando a estrutura disponível.');
      }

      const tacticsByGoal = groupBy(tacticsData as any, 'goal_id');
      const tasksByTactic = groupBy(tasksData as any, 'tactic_id');
      const checkinsByTask = groupBy(checkinsData, 'task_id');

      const weeksToRender = targetCycle.status === 'active' ? currentWeek : totalWeeks;
      const weeklyScoreRows = Array.from({ length: weeksToRender }, (_, index) => {
        const weekNumber = index + 1;
        const bounds = getWeekBounds(cycleStart, weekNumber, totalWeeks);
        const rowTaskIds = tasksData.map((task) => task.id);

        let completedTasks = 0;
        let expectedTasks = 0;

        rowTaskIds.forEach((taskId) => {
          const task = tasksData.find((candidate) => candidate.id === taskId);
          const taskCheckins = checkinsByTask[taskId] ?? [];

          if (!task) return;

          const metrics = buildTaskMetrics(task, taskCheckins, bounds.start, bounds.end, cycleStartDay);
          completedTasks += metrics.completed;
          expectedTasks += metrics.expected;
        });

        const score = expectedTasks > 0 ? Math.round((completedTasks / expectedTasks) * 100) : 0;

        return {
          id: `${targetCycle.id}-${weekNumber}`,
          aluno_id: targetCycle.aluno_id ?? user.id,
          cycle_id: targetCycle.id,
          week_number: weekNumber,
          week_start: formatDateKey(bounds.start),
          week_end: formatDateKey(bounds.end),
          score,
          completed_tasks: completedTasks,
          expected_tasks: expectedTasks,
          is_final: targetCycle.status === 'archived' || weekNumber < currentWeek,
          calculated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        } satisfies WeeklyScore;
      });

      if (weeklyScoreRows.length > 0) {
        const weeklyScoreResponses = await Promise.all(
          weeklyScoreRows.map((row) =>
            supabase.rpc('close_cycle_week', {
              p_cycle_id: targetCycle.id,
              p_week_number: row.week_number,
              p_closed_at: now.toISOString(),
            })
          )
        );

        if (weeklyScoreResponses.some((response) => response.error)) {
          console.warn(
            'usePlan12WY: Weekly score persistence failed',
            weeklyScoreResponses.filter((response) => response.error)
          );
          warningMessages.push('O histórico de score semanal não pôde ser persistido integralmente.');
        }
      }

      const currentWeekScoreRow = weeklyScoreRows.find((row) => row.week_number === currentWeek);
      const cycleScore = weeklyScoreRows.length
        ? Math.round(weeklyScoreRows.reduce((sum, row) => sum + Number(row.score ?? 0), 0) / weeklyScoreRows.length)
        : 0;

      const enrichedGoals: PlanGoal[] = baseGoals.map((goal) => {
        const relatedTactics = tacticsByGoal[goal.id] ?? [];
        const enrichedTactics: PlanTactic[] = relatedTactics.map((tactic: any) => {
          const relatedTasks = tasksByTactic[tactic.id] ?? [];
          const enrichedTasks: PlanTask[] = relatedTasks.map((task: any) => {
            const taskCheckins = checkinsByTask[task.id] ?? [];
            const overallMetrics = buildTaskMetrics(task, taskCheckins, cycleStart, cycleEnd, cycleStartDay);
            const weekMetrics = buildTaskMetrics(task, taskCheckins, weekBounds.start, weekBounds.end, cycleStartDay);
            const todayCheckin = taskCheckins.find((checkin) => checkin.date === currentWeekKey);
            const isTodayInSelectedWeek = currentWeekKey >= formatDateKey(weekBounds.start) && currentWeekKey <= formatDateKey(weekBounds.end);

            return {
              ...task,
              checkins: taskCheckins,
              progress: overallMetrics.progress,
              weeklyProgress: weekMetrics.progress,
              completedToday: Boolean(isTodayInSelectedWeek && todayCheckin?.status === 'done'),
              dueToday: Boolean(
                isTodayInSelectedWeek &&
                  isTaskDueOnDate(task, now, cycleStartDay)
              ),
            } as PlanTask;
          });

          const totalTasks = enrichedTasks.length;
          const progress = totalTasks
            ? Math.round(enrichedTasks.reduce((sum, task) => sum + task.progress, 0) / totalTasks)
            : 0;

          return {
            ...tactic,
            tasks: enrichedTasks,
            progress,
            completedTasks: enrichedTasks.filter((task) => task.completedToday).length,
            totalTasks,
          } as PlanTactic;
        });

        const totalTactics = enrichedTactics.length;
        const progress = totalTactics
          ? Math.round(enrichedTactics.reduce((sum, tactic) => sum + tactic.progress, 0) / totalTactics)
          : 0;

        return {
          ...goal,
          status: goal.status ?? 'active',
          tactics: enrichedTactics,
          progress,
          completedTasks: enrichedTactics.reduce((sum, tactic) => sum + tactic.completedTasks, 0),
          totalTasks: enrichedTactics.reduce((sum, tactic) => sum + tactic.totalTasks, 0),
        } as PlanGoal;
      });

      const totalGoals = enrichedGoals.length;
      const totalTactics = enrichedGoals.reduce((sum, goal) => sum + goal.tactics.length, 0);
      const totalTasks = enrichedGoals.reduce((sum, goal) => sum + goal.totalTasks, 0);
      const cycleProgress = totalGoals
        ? Math.round(enrichedGoals.reduce((sum, goal) => sum + goal.progress, 0) / totalGoals)
        : 0;
      const weeklyDone = weeklyScoreRows.find((row) => row.week_number === currentWeek)?.completed_tasks ?? 0;
      const weeklyExpected = weeklyScoreRows.find((row) => row.week_number === currentWeek)?.expected_tasks ?? 0;

      const weeklyAgendaData = buildWeeklyAgenda(
        enrichedGoals.flatMap((goal) => goal.tactics.flatMap((tactic) => tactic.tasks)),
        weekBounds.start,
        weekBounds.end,
        cycleStartDay,
      );

      const goalLimitReached = totalGoals >= 3;
      const remainingGoals = Math.max(0, 3 - totalGoals);

      setGoals(enrichedGoals);
      setWeeklyScores(weeklyScoreRows);
      setWeeklyAgenda(weeklyAgendaData);
      setSummary({
        cycleProgress,
        weeklyScore: currentWeekScoreRow?.score ?? 0,
        cycleScore,
        currentWeek,
        totalWeeks,
        weekStart: formatDateKey(weekBounds.start),
        weekEnd: formatDateKey(weekBounds.end),
        completedToday: enrichedGoals.reduce(
          (sum, goal) => sum + goal.tactics.reduce((tacticSum, tactic) => tacticSum + tactic.tasks.filter((task) => task.completedToday && task.dueToday).length, 0),
          0,
        ),
        tasksDueToday: enrichedGoals.reduce(
          (sum, goal) => sum + goal.tactics.reduce((tacticSum, tactic) => tacticSum + tactic.tasks.filter((task) => task.dueToday).length, 0),
          0,
        ),
        totalTasks,
        totalGoals,
        totalTactics,
        goalLimitReached,
        remainingGoals,
      });

      if (warningMessages.length) {
        setError(warningMessages.join(' '));
      }
    } catch (err) {
      console.error('Error fetching plan:', err);
      resetPlanState();
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o Plano 12WY.');
    } finally {
      finishLoading();
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [user, selectedCycleId]);

  const createCycle = async (startDate: string) => {
    if (!user) {
      const error = new Error('Usuário não autenticado.');
      setError(error.message);
      return { data: null, error };
    }

    const { data: activeCycleData, error: activeCycleError } = await supabase
      .from('cycles')
      .select('id')
      .eq('aluno_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (activeCycleError) {
      setError(activeCycleError.message);
      return { data: null, error: new Error(activeCycleError.message) };
    }

    if (activeCycleData) {
      const error = new Error('Já existe um ciclo ativo para este aluno.');
      setError(error.message);
      void fetchPlan();
      return { data: null, error };
    }

    const [{ data: latestCycle }, { data: activeEnrollment, error: enrollmentError }] = await Promise.all([
      supabase
        .from('cycles')
        .select('number')
        .eq('aluno_id', user.id)
        .order('number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('enrollments')
        .select('turma_id')
        .eq('aluno_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (enrollmentError) {
      console.warn('usePlan12WY: Enrollment lookup failed, continuing without turma_id', enrollmentError);
    }

    const nextCycleNumber = Number((latestCycle as any)?.number ?? 0) + 1;
    const turmaId = (activeEnrollment as any)?.turma_id ?? null;

    const payload: Record<string, any> = {
      aluno_id: user.id,
      number: nextCycleNumber,
      start_date: startDate,
      status: 'active',
    };

    if (turmaId) {
      payload.turma_id = turmaId;
    }

    const { data, error } = await supabase
      .from('cycles')
      .insert(payload as any)
      .select('*')
      .single();

    if (error) {
      setError(error.message);
      return { data, error: new Error(error.message) };
    }

    const createdCycle = data as Cycle;
    setCycles((current) => [createdCycle, ...current.filter((cycle) => cycle.id !== createdCycle.id)]);
    setActiveCycle(createdCycle);
    setSelectedCycle(createdCycle);
    setSelectedCycleId(createdCycle.id ?? null);
    void fetchPlan();
    return { data, error: null };
  };

  const addGoal = async (payload: { title: string; description?: string; indicator?: string; deadline?: string }) => {
    if (!selectedCycle || selectedCycle.status !== 'active') {
      const error = new Error('Não existe um ciclo ativo para receber novos objetivos.');
      setError(error.message);
      return error;
    }

    if (goals.length >= 3) {
      const error = new Error('Cada ciclo pode ter no máximo 3 objetivos.');
      setError(error.message);
      return error;
    }

    const { error } = await supabase
      .from('goals')
      .insert({
        cycle_id: selectedCycle.id,
        title: payload.title,
        description: payload.description || null,
        indicator: payload.indicator || null,
        deadline: payload.deadline || null,
        order: goals.length,
        status: 'active',
      } as any);

    if (error) {
      setError(error.message);
      return new Error(error.message);
    }

    await fetchPlan();
    return null;
  };

  const addTactic = async (goalId: string, payload: { title: string; description?: string }) => {
    if (!selectedCycle || selectedCycle.status !== 'active') {
      const error = new Error('Selecione um ciclo ativo para criar táticas.');
      setError(error.message);
      return error;
    }

    const { error } = await supabase
      .from('tactics')
      .insert({
        goal_id: goalId,
        title: payload.title,
        description: payload.description || null,
        order: goals.find((goal) => goal.id === goalId)?.tactics.length ?? 0,
      } as any);

    if (error) {
      setError(error.message);
      return new Error(error.message);
    }

    await fetchPlan();
    return null;
  };

  const addTask = async (tacticId: string, payload: { title: string; frequency: Task['frequency']; specificDays?: number[] }) => {
    if (!selectedCycle || selectedCycle.status !== 'active') {
      const error = new Error('Selecione um ciclo ativo para criar tarefas.');
      setError(error.message);
      return error;
    }

    const { error } = await supabase
      .from('tasks')
      .insert({
        tactic_id: tacticId,
        title: payload.title,
        frequency: payload.frequency,
        specific_days: payload.specificDays?.length ? payload.specificDays : null,
      } as any);

    if (error) {
      setError(error.message);
      return new Error(error.message);
    }

    await fetchPlan();
    return null;
  };

  const toggleTaskCheckin = async (taskId: string, date: string, currentStatus: boolean) => {
    if (!selectedCycle || selectedCycle.status !== 'active') {
      const error = new Error('Check-ins só podem ser alterados em um ciclo ativo.');
      setError(error.message);
      return error;
    }

    const targetDate = parseLocalDate(date);
    if (!targetDate) {
      const error = new Error('Data inválida para o check-in.');
      setError(error.message);
      return error;
    }

    const cycleStart = parseLocalDate(selectedCycle.start_date);
    if (!cycleStart) {
      const error = new Error('Ciclo ativo sem data inicial válida.');
      setError(error.message);
      return error;
    }

    const cycleEnd = parseLocalDate(selectedCycle.end_date) ?? getCycleEndDate(cycleStart, Number(summary.totalWeeks ?? 12));
    if (targetDate < cycleStart || targetDate > cycleEnd) {
      const error = new Error('Check-in fora da janela do ciclo ativo.');
      setError(error.message);
      return error;
    }

    const task = goals.flatMap((goal) => goal.tactics.flatMap((tactic) => tactic.tasks)).find((candidate) => candidate.id === taskId);
    if (!task) {
      const error = new Error('Tarefa não encontrada no ciclo ativo.');
      setError(error.message);
      return error;
    }

    if (!isTaskDueOnDate(task, targetDate, cycleStart.getDay())) {
      const error = new Error('Check-in fora da recorrência esperada para esta tarefa.');
      setError(error.message);
      return error;
    }

    const { error } = await supabase
      .from('task_checkins')
      .upsert(
        { task_id: taskId, date, status: currentStatus ? 'not_done' : 'done' } as any,
        { onConflict: 'task_id,date' }
      );

    if (error) {
      setError(error.message);
      return error;
    }

    await fetchPlan();
    return null;
  };

  const clearError = () => setError(null);
  const archivedCycles = cycles.filter((cycle) => cycle.status === 'archived');
  const goalLimitReached = Boolean(summary.goalLimitReached);
  const remainingGoals = Number(summary.remainingGoals ?? Math.max(0, 3 - goals.length));
  const activeCycleState = {
    currentWeek: Number(summary.currentWeek ?? 1),
    totalWeeks: Number(summary.totalWeeks ?? 12),
    cycleProgress: summary.cycleProgress,
    weeklyScore: summary.weeklyScore,
    weekStart: summary.weekStart,
    weekEnd: summary.weekEnd,
    goalLimitReached,
    remainingGoals,
    isActive: Boolean(activeCycle && activeCycle.status === 'active'),
  };
  const canAddGoal = Boolean(selectedCycle && selectedCycle.status === 'active' && !goalLimitReached);

  return {
    goals,
    cycles,
    activeCycle,
    selectedCycle,
    weeklyScores,
    weeklyAgenda,
    weeklyTaskGroups: weeklyAgenda,
    archivedCycles,
    activeCycleState,
    loading,
    error,
    summary,
    canAddGoal,
    goalLimitReached,
    remainingGoals,
    fetchPlan,
    clearError,
    createCycle,
    addGoal,
    addTactic,
    addTask,
    toggleTaskCheckin,
    setSelectedCycleId,
  };
}

export function useGamification() {
  const { user } = useAuth();
  const [badges, setBadges] = useState<any[]>([]);
  const [availableBadges, setAvailableBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBadges = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const finishLoading = createLoadingFinisher(setLoading);
    try {
      console.log('useGamification: Fetching for', user.id);
      const [allRes, userRes] = await Promise.all([
        supabase.from('badges').select('*'),
        supabase.from('user_badges').select('*, badges(*)').eq('user_id', user.id)
      ]);

      if (allRes.data) setAvailableBadges(allRes.data);
      if (userRes.data) setBadges(userRes.data);
    } catch (err) {
      console.error('useGamification error:', err);
    } finally {
      finishLoading();
    }
  };

  useEffect(() => {
    fetchBadges();
  }, [user]);

  const unlockBadge = async (secretCode: string) => {
    if (!user) return;
    const badge = availableBadges.find(b => b.secret_code === secretCode);
    if (!badge) return;

    const { error } = await supabase
      .from('user_badges')
      .insert({ user_id: user.id, badge_id: badge.id });
    
    if (!error) fetchBadges();
    return error;
  };

  return { badges, availableBadges, loading, unlockBadge };
}

export function useEnrollments() {
  const { user, profile } = useAuth();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEnrollments = async () => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const finishLoading = createLoadingFinisher(setLoading);
    try {
      console.log('useEnrollments: Fetching for', user.id);
      let query = supabase.from('enrollments').select('*, turmas(*), profiles!enrollments_aluno_id_fkey(*)');
      
      if (profile.role === 'ALUNO') {
        query = query.eq('aluno_id', user.id);
      } else if (profile.role === 'TREINADOR') {
        query = query.eq('turmas.treinador_id', user.id);
      }

      const { data, error } = await query;
      if (error) {
        console.error('useEnrollments error', error);
        throw error;
      }
      if (data) setEnrollments(data);
    } catch (err) {
      console.error(err);
    } finally {
      finishLoading();
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [user, profile]);

  return { enrollments, loading };
}
