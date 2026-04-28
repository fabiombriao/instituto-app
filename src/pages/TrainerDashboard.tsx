import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CheckCircle,
  Eye,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import type {
  Profile,
  WeeklyScore,
  Habit,
  HabitCheckin,
  ROIResult,
  ROIBaseline,
  Enrollment,
  Cycle,
} from '../types';

type SortField = 'name' | 'score' | 'streak' | 'roi';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'at-risk' | 'above-target';

interface StudentMetrics {
  profile: Profile;
  enrollment: Enrollment;
  cycle: Cycle | null;
  weeklyScore: WeeklyScore | null;
  currentStreak: number;
  totalROI: number;
  status: 'at-risk' | 'on-track' | 'above-target';
}

interface StudentModalData {
  student: StudentMetrics;
  weeklyScores: WeeklyScore[];
  habits: (Habit & { checkins: HabitCheckin[] })[];
  roiResults: ROIResult[];
  roiBaseline: ROIBaseline | null;
}

const STATUS_FILTERS: Record<StatusFilter, { label: string; className: string }> = {
  all: { label: 'Todos', className: 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' },
  'at-risk': { label: 'Em Risco', className: 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30' },
  'above-target': { label: 'Acima da Meta', className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30' },
};

const SORT_LABELS: Record<SortField, string> = {
  name: 'Nome',
  score: 'Score Semanal',
  streak: 'Streak',
  roi: 'ROI Acumulado',
};

export default function TrainerDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentModalData | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const canView = profile?.role === 'SUPER_ADMIN' || profile?.role === 'TREINADOR';

  useEffect(() => {
    if (!canView) {
      navigate('/');
      return;
    }
    fetchStudentsData();
  }, [profile, navigate]);

  const fetchStudentsData = async () => {
    setLoading(true);
    try {
      const [profilesRes, enrollmentsRes, cyclesRes, weeklyScoresRes, habitsRes, habitCheckinsRes, roiResultsRes] =
        await Promise.all([
          supabase.from('profiles').select('*').order('full_name', { ascending: true }),
          supabase.from('enrollments').select('*').eq('status', 'active'),
          supabase.from('cycles').select('*').eq('status', 'active'),
          supabase.from('weekly_scores').select('*').order('created_at', { ascending: false }),
          supabase.from('habits').select('*').eq('is_paused', false),
          supabase.from('habit_checkins').select('*'),
          supabase.from('roi_results').select('*').order('date', { ascending: false }),
        ]);

      if (profilesRes.error) throw profilesRes.error;
      if (enrollmentsRes.error) throw enrollmentsRes.error;
      if (cyclesRes.error) throw cyclesRes.error;
      if (weeklyScoresRes.error) throw weeklyScoresRes.error;
      if (habitsRes.error) throw habitsRes.error;
      if (habitCheckinsRes.error) throw habitCheckinsRes.error;
      if (roiResultsRes.error) throw roiResultsRes.error;

      const profiles = profilesRes.data ?? [];
      const enrollments = enrollmentsRes.data ?? [];
      const cycles = cyclesRes.data ?? [];
      const weeklyScores = weeklyScoresRes.data ?? [];
      const habits = habitsRes.data ?? [];
      const habitCheckins = habitCheckinsRes.data ?? [];
      const roiResults = roiResultsRes.data ?? [];

      const studentsData: StudentMetrics[] = enrollments
        .filter((enrollment) => enrollment.aluno_id)
        .map((enrollment) => {
          const profile = profiles.find((p) => p.id === enrollment.aluno_id);
          if (!profile) return null;

          const cycle = cycles.find((c) => c.aluno_id === enrollment.aluno_id) ?? null;
          const studentWeeklyScores = weeklyScores.filter((ws) => ws.aluno_id === enrollment.aluno_id);
          const latestScore = studentWeeklyScores.length > 0 ? studentWeeklyScores[0] : null;

          const studentHabits = habits.filter((h) => h.aluno_id === enrollment.aluno_id);
          const currentStreak = calculateCurrentStreak(studentHabits, habitCheckins);

          const studentROI = roiResults.filter((r) => r.aluno_id === enrollment.aluno_id);
          const totalROI = studentROI.reduce((sum, r) => sum + (r.amount ?? 0), 0);

          const scoreValue = latestScore?.score ?? 0;
          let status: StudentMetrics['status'] = 'on-track';
          if (scoreValue < 60) status = 'at-risk';
          else if (scoreValue >= 80) status = 'above-target';

          return {
            profile,
            enrollment,
            cycle,
            weeklyScore: latestScore,
            currentStreak,
            totalROI,
            status,
          };
        })
        .filter((student): student is StudentMetrics => student !== null);

      setStudents(studentsData);
    } catch (error) {
      console.error('Error fetching students data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCurrentStreak = (habits: Habit[], allCheckins: HabitCheckin[]): number => {
    const today = new Date();
    let maxStreak = 0;

    habits.forEach((habit) => {
      const habitCheckins = allCheckins.filter((hc) => hc.habit_id === habit.id);
      let streak = 0;
      const checkinDates = new Set(habitCheckins.filter((hc) => hc.status).map((hc) => hc.date));

      for (let i = 0; i < 365; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];

        if (checkinDates.has(dateKey)) {
          streak++;
        } else {
          break;
        }
      }
      maxStreak = Math.max(maxStreak, streak);
    });

    return maxStreak;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleStudentClick = async (student: StudentMetrics) => {
    setModalLoading(true);
    setSelectedStudent(null);
    try {
      const [weeklyScoresRes, habitsRes, habitCheckinsRes, roiResultsRes, roiBaselineRes] = await Promise.all([
        supabase.from('weekly_scores').select('*').eq('aluno_id', student.profile.id).order('week_number', { ascending: true }),
        supabase.from('habits').select('*').eq('aluno_id', student.profile.id).eq('is_paused', false),
        supabase.from('habit_checkins').select('*'),
        supabase.from('roi_results').select('*').eq('aluno_id', student.profile.id).order('date', { ascending: false }),
        supabase.from('roi_baselines').select('*').eq('aluno_id', student.profile.id).order('created_at', { ascending: false }).limit(1),
      ]);

      const habitsWithCheckins = (habitsRes.data ?? []).map((habit) => ({
        ...habit,
        checkins: (habitCheckinsRes.data ?? []).filter((hc) => hc.habit_id === habit.id),
      }));

      setSelectedStudent({
        student,
        weeklyScores: weeklyScoresRes.data ?? [],
        habits: habitsWithCheckins,
        roiResults: roiResultsRes.data ?? [],
        roiBaseline: roiBaselineRes.data?.[0] ?? null,
      });
    } catch (error) {
      console.error('Error fetching student details:', error);
    } finally {
      setModalLoading(false);
    }
  };

  const filteredAndSortedStudents = useMemo(() => {
    let filtered = students;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.profile.full_name?.toLowerCase().includes(term) || s.profile.email?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = (a.profile.full_name ?? '').localeCompare(b.profile.full_name ?? '');
          break;
        case 'score':
          comparison = (a.weeklyScore?.score ?? 0) - (b.weeklyScore?.score ?? 0);
          break;
        case 'streak':
          comparison = a.currentStreak - b.currentStreak;
          break;
        case 'roi':
          comparison = a.totalROI - b.totalROI;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [students, searchTerm, statusFilter, sortField, sortOrder]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const getStatusBadge = (status: StudentMetrics['status']) => {
    switch (status) {
      case 'at-risk':
        return (
          <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-rose-400">
            <TrendingDown className="w-3 h-3" />
            Em Risco
          </span>
        );
      case 'above-target':
        return (
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            Acima da Meta
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-blue-400">
            <CheckCircle className="w-3 h-3" />
            No Ritmo
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none mb-2 text-white">
            Dashboard do Treinador
          </h1>
          <p className="text-xs font-bold tracking-[0.2em] text-neutral-500 uppercase">
            Acompanhamento de performance dos alunos
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="BUSCAR ALUNO..."
              className="bg-[#050505] border border-[#1a1a1a] rounded-xl pl-12 pr-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-brand-green transition-all w-full md:w-64 text-white"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_FILTERS).map(([key, { label, className }]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key as StatusFilter)}
            className={cn(
              'rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all',
              statusFilter === key ? className : 'bg-[#0a0a0a] text-neutral-500 hover:bg-neutral-900'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-[#050505] rounded-[32px] card-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
                {(['name', 'score', 'streak', 'roi'] as SortField[]).map((field) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 cursor-pointer hover:text-neutral-400 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2">
                      {SORT_LABELS[field]}
                      {getSortIcon(field)}
                    </div>
                  </th>
                ))}
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
                  Status
                </th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {filteredAndSortedStudents.map((student) => (
                <tr
                  key={student.profile.id}
                  className="group hover:bg-[#0a0a0a] transition-all cursor-pointer"
                  onClick={() => handleStudentClick(student)}
                >
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center font-black text-white text-xs">
                        {student.profile.full_name?.charAt(0) || student.profile.email?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase text-white tracking-tight leading-none mb-1">
                          {student.profile.full_name || 'Anônimo'}
                        </p>
                        <p className="text-[10px] text-neutral-600 font-mono">
                          {student.cycle?.number ? `Ciclo ${student.cycle.number}` : 'Sem ciclo'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div
                      className={cn(
                        'text-lg font-black italic',
                        (student.weeklyScore?.score ?? 0) >= 80
                          ? 'text-emerald-400'
                          : (student.weeklyScore?.score ?? 0) < 60
                            ? 'text-rose-400'
                            : 'text-blue-400'
                      )}
                    >
                      {student.weeklyScore?.score ?? 0}%
                    </div>
                    <p className="text-[8px] text-neutral-600 uppercase font-mono">
                      Semana {student.weeklyScore?.week_number || '-'}
                    </p>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-brand-green" />
                      <span className="text-lg font-black italic text-white">{student.currentStreak}</span>
                      <span className="text-[8px] text-neutral-600 uppercase">dias</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="text-lg font-black italic text-emerald-400">
                      R$ {student.totalROI.toLocaleString('pt-BR')}
                    </div>
                  </td>
                  <td className="p-6">{getStatusBadge(student.status)}</td>
                  <td className="p-6 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleStudentClick(student)}
                      className="inline-flex items-center gap-2 rounded-xl border border-brand-green/20 bg-brand-green/10 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-brand-green transition-colors hover:border-brand-green/40 hover:text-brand-green/90"
                    >
                      <Eye className="w-3 h-3" />
                      Ver Dashboard
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAndSortedStudents.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center">
              <Search className="w-12 h-12 text-neutral-900 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-700">
                Nenhum aluno encontrado
              </p>
              <p className="text-[10px] uppercase tracking-widest text-neutral-700 mt-3 max-w-md">
                Não há correspondência para os filtros atuais. Tente ajustar a busca ou os filtros de status.
              </p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStudent(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-[#050505] border border-[#1a1a1a] rounded-[32px] overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-[#1a1a1a] flex justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center font-black text-white text-xl">
                    {selectedStudent.student.profile.full_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                      {selectedStudent.student.profile.full_name}
                    </h3>
                    <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">
                      {selectedStudent.student.profile.email}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      {getStatusBadge(selectedStudent.student.status)}
                      <span className="text-[8px] text-neutral-600 uppercase font-mono">
                        Ciclo {selectedStudent.student.cycle?.number || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="w-10 h-10 rounded-full border border-[#1a1a1a] flex items-center justify-center hover:bg-[#0a0a0a]"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-6 rounded-3xl">
                    <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest mb-1">
                      Score Semanal
                    </p>
                    <p
                      className={cn(
                        'text-2xl font-black italic',
                        (selectedStudent.student.weeklyScore?.score ?? 0) >= 80
                          ? 'text-emerald-400'
                          : (selectedStudent.student.weeklyScore?.score ?? 0) < 60
                            ? 'text-rose-400'
                            : 'text-blue-400'
                      )}
                    >
                      {selectedStudent.student.weeklyScore?.score ?? 0}%
                    </p>
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-6 rounded-3xl">
                    <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest mb-1">
                      Streak Atual
                    </p>
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-brand-green" />
                      <p className="text-2xl font-black italic text-white">{selectedStudent.student.currentStreak}</p>
                      <span className="text-xs text-neutral-600">dias</span>
                    </div>
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-6 rounded-3xl">
                    <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest mb-1">
                      ROI Acumulado
                    </p>
                    <p className="text-2xl font-black italic text-emerald-400">
                      R$ {selectedStudent.student.totalROI.toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-4">
                    Evolução Semanal
                  </h4>
                  <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-2">
                    {selectedStudent.weeklyScores.map((week) => (
                      <div key={week.id} className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 rounded-2xl text-center">
                        <p className="text-[8px] font-black text-neutral-600 uppercase">Sem {week.week_number}</p>
                        <p
                          className={cn(
                            'mt-1 text-sm font-black italic',
                            week.score >= 80
                              ? 'text-emerald-400'
                              : week.score < 60
                                ? 'text-rose-400'
                                : 'text-blue-400'
                          )}
                        >
                          {week.score}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-4">
                    Resultados de ROI Recentes
                  </h4>
                  <div className="space-y-2">
                    {selectedStudent.roiResults.length > 0 ? (
                      selectedStudent.roiResults.slice(0, 5).map((result) => (
                        <div
                          key={result.id}
                          className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-2xl flex justify-between items-center"
                        >
                          <div>
                            <p className="text-xs text-white font-mono">{result.description || 'Resultado'}</p>
                            <p className="text-[8px] text-neutral-600 uppercase">
                              {new Date(result.date).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <p className="text-sm font-black italic text-emerald-400">
                            R$ {result.amount.toLocaleString('pt-BR')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#1a1a1a] bg-[#0a0a0a] p-5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                          Nenhum resultado registrado
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-4">
                    Hábitos Ativos
                  </h4>
                  <div className="space-y-2">
                    {selectedStudent.habits.length > 0 ? (
                      selectedStudent.habits.map((habit) => {
                        const streak = calculateCurrentStreak([habit], habit.checkins);
                        return (
                          <div
                            key={habit.id}
                            className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-2xl flex justify-between items-center"
                          >
                            <div>
                              <p className="text-xs text-white font-mono">{habit.name}</p>
                              <p className="text-[8px] text-neutral-600 uppercase">
                                {habit.frequency === 'daily' ? 'Diário' : habit.frequency === 'weekly' ? 'Semanal' : 'Dias específicos'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-brand-green" />
                              <span className="text-sm font-black italic text-white">{streak}</span>
                              <span className="text-[8px] text-neutral-600">dias</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#1a1a1a] bg-[#0a0a0a] p-5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                          Nenhum hábito ativo
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-[#1a1a1a] bg-[#030303]">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="w-full py-4 border border-[#1a1a1a] rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-neutral-900 transition-all flex items-center justify-center gap-2"
                >
                  Fechar detalhes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#050505] border border-[#1a1a1a] rounded-[32px] p-8 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Carregando dados do aluno...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
