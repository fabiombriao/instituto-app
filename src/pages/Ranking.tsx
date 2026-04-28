import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Crown, Loader2, Medal, Search, Flame, Activity, Trophy } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useEnrollments } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { canViewFinancialROI } from '../lib/roiAccess';
import { cn } from '../lib/utils';

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  email: string | null;
  created_at: string;
};

type RankedRow = ProfileRow & {
  score: number;
  habitScore: number;
  badgeCount: number;
  roiScore: number;
  streak: number;
  lastActivity: string | null;
  completedCheckins: number;
  possibleCheckins: number;
  hasData: boolean;
};

function normalizeRole(role?: string | null) {
  return String(role ?? '').trim().toUpperCase();
}

function isStudent(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized === 'ALUNO' || normalized === 'ALUNO_GRADUADO';
}

function roleLabel(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized ? normalized.replaceAll('_', ' ') : 'ALUNO';
}

function toDateKey(value: Date) {
  return format(value, 'yyyy-MM-dd');
}

function computeUserScore(
  userId: string,
  habitsByUser: Record<string, any[]>,
  badgeCounts: Record<string, number>,
  roiTotals: Record<string, number>
) {
  const today = new Date();
  const windowDates = new Set(
    Array.from({ length: 7 }, (_, index) => format(subDays(today, index), 'yyyy-MM-dd'))
  );

  const userHabits = (habitsByUser[userId] ?? []) as Array<{
    is_paused?: boolean | null;
    habit_checkins?: Array<{ date: string; status: boolean }>;
  }>;
  const activeHabits = userHabits.filter((habit) => !habit.is_paused);
  const completedCheckins = activeHabits.reduce((sum, habit) => {
    return (
      sum +
      (habit.habit_checkins ?? []).filter((checkin) => checkin.status && windowDates.has(checkin.date)).length
    );
  }, 0);
  const possibleCheckins = activeHabits.length * 7;
  const habitScore = possibleCheckins > 0 ? Math.round((completedCheckins / possibleCheckins) * 100) : 0;

  const streakDates = new Set<string>();
  let lastActivity: string | null = null;
  activeHabits.forEach((habit) => {
    (habit.habit_checkins ?? []).forEach((checkin) => {
      if (checkin.status) {
        streakDates.add(checkin.date);
      }
      if (!lastActivity || checkin.date > lastActivity) {
        lastActivity = checkin.date;
      }
    });
  });

  let streak = 0;
  for (let day = 0; day < 60; day += 1) {
    const key = toDateKey(subDays(today, day));
    if (streakDates.has(key)) {
      streak += 1;
      continue;
    }
    break;
  }

  const badgeCount = badgeCounts[userId] ?? 0;
  const roiTotal = roiTotals[userId] ?? 0;
  const roiScore = Math.min(15, Math.round(Math.max(roiTotal, 0) / 1500));
  const score = Math.min(
    100,
    Math.round(habitScore * 0.55 + Math.min(badgeCount * 6, 24) + roiScore + Math.min(streak * 2, 16))
  );

  return {
    score,
    habitScore,
    badgeCount,
    roiScore,
    streak,
    lastActivity,
    completedCheckins,
    possibleCheckins,
    hasData: possibleCheckins > 0 || badgeCount > 0 || roiTotal > 0,
  };
}

export default function Ranking() {
  const { profile } = useAuth();
  const { enrollments, loading: enrollmentsLoading } = useEnrollments();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RankedRow[]>([]);
  const [scopeLabel, setScopeLabel] = useState('Visão global');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchRanking = async () => {
      setLoading(true);
      setError(null);

      try {
        const activeEnrollment = enrollments.find((entry: any) => entry?.status === 'active') ?? enrollments[0];
        let participants: ProfileRow[] = [];
        let studentIds: string[] = [];
        let scope = 'Visão global';

        if (activeEnrollment?.turma_id) {
          const { data: enrollmentRows, error: enrollmentError } = await supabase
            .from('enrollments')
            .select('aluno_id')
            .eq('turma_id', activeEnrollment.turma_id)
            .eq('status', 'active');

          if (enrollmentError) throw enrollmentError;

          studentIds = Array.from(
            new Set((enrollmentRows ?? []).map((row: any) => row.aluno_id).filter(Boolean))
          );
          scope = activeEnrollment?.turmas?.name ? `Turma ${activeEnrollment.turmas.name}` : 'Turma atual';

          if (studentIds.length > 0) {
            const { data: profileRows, error: profileError } = await supabase
              .from('profiles')
              .select('id, full_name, role, email, created_at')
              .in('id', studentIds);

            if (profileError) throw profileError;
            participants = (profileRows ?? []).filter((profile) => isStudent(profile.role));
          }
        }

        if (participants.length === 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, role, email, created_at');

          if (profileError) throw profileError;
          participants = (profileRows ?? []).filter((profile) => isStudent(profile.role));
          studentIds = participants.map((participant) => participant.id);
          scope = 'Visão global';
        } else {
          studentIds = participants.map((participant) => participant.id);
        }

        if (studentIds.length === 0) {
          if (!cancelled) {
            setRows([]);
            setScopeLabel(scope);
          }
          return;
        }

        const financialROIVisible = canViewFinancialROI(profile?.role);

        const [habitsRes, badgesRes, roiResultsRes] = await Promise.all([
          supabase.from('habits').select('aluno_id, is_paused, habit_checkins(date, status)').in('aluno_id', studentIds),
          supabase.from('user_badges').select('user_id, badge_id').in('user_id', studentIds),
          financialROIVisible
            ? supabase.from('roi_results').select('aluno_id, amount').in('aluno_id', studentIds)
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        const queryError = habitsRes.error || badgesRes.error || roiResultsRes.error;
        if (queryError) throw queryError;

        const habitsByUser = (habitsRes.data ?? []).reduce((acc: Record<string, any[]>, row: any) => {
          acc[row.aluno_id] = acc[row.aluno_id] ?? [];
          acc[row.aluno_id].push(row);
          return acc;
        }, {} as Record<string, any[]>);
        const badgeCounts = (badgesRes.data ?? []).reduce((acc: Record<string, number>, row: any) => {
          acc[row.user_id] = (acc[row.user_id] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const roiTotals = (roiResultsRes.data ?? []).reduce((acc: Record<string, number>, row: any) => {
          acc[row.aluno_id] = (acc[row.aluno_id] ?? 0) + Number(row.amount ?? 0);
          return acc;
        }, {} as Record<string, number>);

        const ranked = participants
          .map((participant) => {
            const stats = computeUserScore(participant.id, habitsByUser, badgeCounts, roiTotals);
            return {
              ...participant,
              ...stats,
            };
          })
          .sort(
            (a, b) =>
              b.score - a.score ||
              b.habitScore - a.habitScore ||
              b.badgeCount - a.badgeCount ||
              String(a.full_name ?? '').localeCompare(String(b.full_name ?? ''))
          );

        if (!cancelled) {
          setRows(ranked);
          setScopeLabel(scope);
        }
      } catch (fetchError) {
        if (!cancelled) {
          console.error('Error fetching ranking:', fetchError);
          setError('Não foi possível carregar o ranking real agora.');
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchRanking();

    return () => {
      cancelled = true;
    };
  }, [enrollments, refreshToken, profile?.role]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      return (
        row.full_name?.toLowerCase().includes(term) ||
        row.email?.toLowerCase().includes(term) ||
        roleLabel(row.role).toLowerCase().includes(term)
      );
    });
  }, [rows, searchTerm]);

  const summary = useMemo(() => {
    if (rows.length === 0) return null;

    const averageScore = Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length);
    const averageStreak = Math.round(rows.reduce((sum, row) => sum + row.streak, 0) / rows.length);
    const topProfile = rows[0];
    return {
      averageScore,
      averageStreak,
      topProfile,
    };
  }, [rows]);

  const isLoading = loading || enrollmentsLoading;

  return (
    <div className="space-y-10 pb-12 font-sans">
      <header>
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-green mb-4 block">
              Gamificação real
            </span>
            <h1 className="text-7xl font-black italic tracking-tighter uppercase leading-[0.8] text-white">
              Ranking da Turma
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full border border-[#1a1a1a] bg-[#050505] text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
                {scopeLabel}
              </span>
              <span className="px-3 py-1 rounded-full border border-brand-green/20 bg-brand-green/10 text-[9px] font-black uppercase tracking-[0.2em] text-brand-green">
                {rows.length} aluno(s)
              </span>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="BUSCAR COMPETIDOR..."
              className="bg-[#050505] border border-[#1a1a1a] rounded-xl pl-12 pr-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-brand-green transition-all w-full md:w-64 text-white"
            />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2">Média real</p>
          <p className="text-4xl font-black italic uppercase text-white">{summary ? `${summary.averageScore}%` : 'N/D'}</p>
        </div>
        <div className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2">Sequência média</p>
          <p className="text-4xl font-black italic uppercase text-white">{summary ? `${summary.averageStreak}d` : 'N/D'}</p>
        </div>
        <div className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2">Em destaque</p>
          <p className="text-4xl font-black italic uppercase text-white">
            {summary?.topProfile ? summary.topProfile.full_name || 'Sem nome' : 'N/D'}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-4 text-rose-100">
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Atenção</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-4">
          {isLoading ? (
            <div className="bg-[#050505] border border-[#1a1a1a] rounded-[32px] p-10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            </div>
          ) : filteredRows.length > 0 ? (
            filteredRows.map((user, idx) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  'flex items-center justify-between rounded-[32px] border p-6 transition-all group',
                  idx === 0 ? 'bg-brand-green/10 border-brand-green/20' : 'bg-[#050505] border-[#1a1a1a]'
                )}
              >
                <div className="flex items-center gap-6">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-2xl text-2xl font-black italic',
                      idx === 0 ? 'brand-gradient text-black' : 'bg-neutral-900 text-neutral-500'
                    )}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-[10px] font-black text-white">
                      {user.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase italic text-white">{user.full_name || 'Sem nome'}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                        {roleLabel(user.role)} · {user.badgeCount} badge(s)
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-neutral-700">
                        {user.hasData
                          ? canViewFinancialROI(profile?.role)
                            ? `${user.habitScore}% hábitos · ROI ${user.roiScore} · sequência ${user.streak}d`
                            : `${user.habitScore}% hábitos · ROI oculto · sequência ${user.streak}d`
                          : 'Sem dados suficientes para um score completo'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">
                      Score calculado
                    </p>
                    <p className={cn('text-3xl font-black italic tracking-tighter', idx === 0 ? 'text-brand-green' : 'text-white')}>
                      {user.score}%
                    </p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-600">
                      {user.completedCheckins}/{user.possibleCheckins || 0} check-ins
                    </p>
                  </div>
                  {idx === 0 && <Crown className="w-8 h-8 text-brand-green" />}
                  {idx === 1 && <Medal className="w-8 h-8 text-neutral-400" />}
                  {idx === 2 && <Medal className="w-8 h-8 text-amber-700" />}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="rounded-[40px] border border-dashed border-[#1a1a1a] bg-[#050505] p-16 text-center">
              <Trophy className="mx-auto mb-6 h-12 w-12 text-neutral-800" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-700">
                Nenhum aluno encontrado para ranquear
              </p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-neutral-700">
                A turma atual ainda não tem dados suficientes para montar a classificação.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-[40px] border border-[#1a1a1a] bg-[#050505] p-8">
            <h3 className="mb-6 text-xl font-black italic uppercase text-center text-white">Como funciona</h3>
            <div className="space-y-5">
              {[
                { label: 'Hábitos', desc: 'Check-ins reais dos últimos 7 dias valem a maior parte do score.' },
                { label: 'Badges', desc: 'Cada badge desbloqueado adiciona pontos de consistência.' },
                { label: 'ROI', desc: 'Lançamentos financeiros reforçam a colocação quando existem.' },
                { label: 'Streak', desc: 'Sequências diárias entram como bônus de continuidade.' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green">{item.label}</p>
                  <p className="text-xs font-mono uppercase leading-relaxed text-neutral-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[40px] border border-[#1a1a1a] bg-[#050505] p-8">
            <div className="flex items-center gap-3">
              <Flame className="w-6 h-6 text-brand-green" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Regra de desempate</p>
            </div>
            <p className="mt-4 text-sm text-neutral-400 leading-relaxed">
              Em caso de empate, a sequência atual de hábitos e a data da última atividade definem a posição.
            </p>
          </div>

          <div className="rounded-[40px] border border-[#1a1a1a] bg-[#050505] p-8">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-brand-green" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Última atualização</p>
            </div>
            <p className="mt-4 text-sm font-black uppercase tracking-widest text-white">
              {format(new Date(), "dd 'de' MMMM 'às' HH:mm")}
            </p>
            <button
              type="button"
              onClick={() => setRefreshToken((value) => value + 1)}
              className="mt-6 w-full py-4 brand-gradient rounded-2xl text-black font-black uppercase text-xs tracking-widest shadow-lg shadow-brand-green/20"
            >
              Atualizar ranking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
