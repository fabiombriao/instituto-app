import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  Loader2,
  MessageSquare,
  Search,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGraduatedStudents } from '../hooks/useData';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import type { GraduatedStudent, CoachNote } from '../types';

type SortField = 'name' | 'score' | 'streak' | 'status';
type SortOrder = 'asc' | 'desc';
type RiskStatus = 'all' | 'at-risk' | 'on-track';

const RISK_FILTERS: Record<RiskStatus, { label: string; className: string }> = {
  all: { label: 'Todos', className: 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' },
  'at-risk': { label: 'Em Risco', className: 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30' },
  'on-track': { label: 'No Alvo', className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30' },
};

const SORT_LABELS: Record<SortField, string> = {
  name: 'Nome',
  score: 'Score Semanal',
  streak: 'Streak',
  status: 'Status',
};

interface StudentDetail extends GraduatedStudent {
  notes: CoachNote[];
  notesLoading: boolean;
}

export default function GraduatedDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { students, alerts, loading, refreshAlerts, dismissAlert } = useGraduatedStudents();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [riskFilter, setRiskFilter] = useState<RiskStatus>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);

  const canView = profile?.role === 'ALUNO_GRADUADO';

  useEffect(() => {
    if (!canView) {
      navigate('/');
      return;
    }
  }, [profile, navigate, canView]);

  // RF48: Automação - Refresh alertas a cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      refreshAlerts();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [refreshAlerts]);

  const filteredStudents = useMemo(() => {
    let filtered = [...students];

    // Filtrar por status de risco
    if (riskFilter === 'at-risk') {
      filtered = filtered.filter((s) => s.latest_weekly_score < 60 || s.has_active_alert);
    } else if (riskFilter === 'on-track') {
      filtered = filtered.filter((s) => s.latest_weekly_score >= 60 && !s.has_active_alert);
    }

    // Filtrar por busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.aluno_name.toLowerCase().includes(term) ||
          s.aluno_email.toLowerCase().includes(term) ||
          s.turma_name?.toLowerCase().includes(term)
      );
    }

    // Ordenar
    filtered.sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      if (sortField === 'name') {
        aVal = a.aluno_name;
        bVal = b.aluno_name;
      } else if (sortField === 'score') {
        aVal = a.latest_weekly_score ?? 0;
        bVal = b.latest_weekly_score ?? 0;
      } else if (sortField === 'streak') {
        aVal = a.current_streak;
        bVal = b.current_streak;
      } else if (sortField === 'status') {
        aVal = a.has_active_alert ? 0 : 1;
        bVal = b.has_active_alert ? 0 : 1;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [students, searchTerm, sortField, sortOrder, riskFilter]);

  const loadStudentNotes = async (student: GraduatedStudent) => {
    setNotesLoading(true);
    try {
      const { data, error } = await supabase
        .from('coach_notes')
        .select('*')
        .eq('aluno_id', student.aluno_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSelectedStudent({
        ...student,
        notes: (data ?? []) as CoachNote[],
        notesLoading: false,
      });
    } catch (err) {
      console.error('Error loading notes:', err);
      setSelectedStudent((prev) =>
        prev
          ? {
              ...prev,
              notesLoading: false,
            }
          : null
      );
    } finally {
      setNotesLoading(false);
    }
  };

  const getRiskColor = (score: number, hasAlert: boolean) => {
    if (hasAlert) return 'text-rose-400';
    if (score < 60) return 'text-amber-400';
    if (score >= 80) return 'text-emerald-400';
    return 'text-cyan-400';
  };

  const getRiskBg = (score: number, hasAlert: boolean) => {
    if (hasAlert) return 'bg-rose-500/10 border-rose-500/30';
    if (score < 60) return 'bg-amber-500/10 border-amber-500/30';
    if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/30';
    return 'bg-cyan-500/10 border-cyan-500/30';
  };

  const getStatusLabel = (student: GraduatedStudent) => {
    if (student.has_active_alert) return 'Em Risco';
    if (student.latest_weekly_score < 60) return 'Atenção';
    if (student.latest_weekly_score >= 80) return 'Excelente';
    return 'No Alvo';
  };

  const activeAlerts = alerts.filter((a) => a.alert_status === 'active');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!canView) {
    return null;
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header com Métricas */}
      <div>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Alunos sob Responsabilidade</h1>
        <p className="mt-2 text-sm text-neutral-400">Monitore o desempenho dos seus alunos e acompanhe alertas</p>

        {/* Cards de resumo */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-[#1a1a1a] bg-[#050505] p-6"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Total de Alunos</p>
            <p className="mt-4 text-3xl font-black text-white">{students.length}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-3xl border border-[#1a1a1a] bg-[#050505] p-6"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">Alertas Ativos</p>
            <p className="mt-4 text-3xl font-black text-rose-400">{activeAlerts.length}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border border-[#1a1a1a] bg-[#050505] p-6"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">No Alvo</p>
            <p className="mt-4 text-3xl font-black text-emerald-400">
              {students.filter((s) => s.latest_weekly_score >= 60 && !s.has_active_alert).length}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-3xl border border-[#1a1a1a] bg-[#050505] p-6"
          >
            <button
              onClick={() => refreshAlerts()}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 hover:text-cyan-400 transition-colors"
            >
              Atualizar Alertas
            </button>
            <p className="mt-4 text-sm text-neutral-400">Verificar baixos scores</p>
          </motion.div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 w-5 h-5 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar por nome, email ou turma..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] pl-12 pr-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {(Object.entries(RISK_FILTERS) as [RiskStatus, any][]).map(([key, { label, className }]) => (
              <button
                key={key}
                onClick={() => setRiskFilter(key)}
                className={cn(
                  'rounded-2xl border px-4 py-2 text-sm font-semibold transition-all',
                  riskFilter === key ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400' : className
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Ordenação */}
        <div className="flex gap-2 flex-wrap">
          {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => {
                if (sortField === field) {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField(field);
                  setSortOrder('desc');
                }
              }}
              className={cn(
                'rounded-2xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-all',
                sortField === field
                  ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                  : 'border-[#1a1a1a] bg-[#050505] text-neutral-400 hover:bg-[#0f0f0f]'
              )}
            >
              {label}
              {sortField === field && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
          ))}
        </div>
      </div>

      {/* Alertas ativos */}
      {activeAlerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-rose-400">Alertas Ativos</h3>
              <p className="mt-2 text-sm text-neutral-400">{activeAlerts.length} aluno(s) abaixo de 60% por 2+ semanas</p>
              <div className="mt-4 space-y-2">
                {activeAlerts.map((alert) => {
                  const student = students.find((s) => s.aluno_id === alert.aluno_id);
                  return (
                    <div key={alert.id} className="flex items-center justify-between text-xs text-neutral-300">
                      <span>{student?.aluno_name || 'Aluno'} - {alert.consecutive_low_weeks} semanas</span>
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Lista de alunos */}
      {filteredStudents.length === 0 ? (
        <div className="rounded-3xl border border-[#1a1a1a] bg-[#050505] p-12 text-center">
          <p className="text-neutral-500">Nenhum aluno encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredStudents.map((student) => (
            <motion.div
              key={student.aluno_id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border transition-all cursor-pointer hover:border-cyan-500/50',
                student.has_active_alert
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : student.latest_weekly_score < 60
                    ? 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10'
                    : 'border-[#1a1a1a] bg-[#050505] hover:bg-[#0f0f0f]'
              )}
              onClick={() => loadStudentNotes(student)}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="font-semibold text-white truncate">{student.aluno_name}</h3>
                      <p className="text-xs text-neutral-500 truncate">{student.aluno_email}</p>
                    </div>
                  </div>
                  {student.turma_name && <p className="mt-1 text-xs text-neutral-400">{student.turma_name}</p>}
                </div>

                <div className="flex items-center gap-4 ml-4">
                  {/* Score */}
                  <div className="text-right">
                    <p className={cn('text-2xl font-black', getRiskColor(student.latest_weekly_score, student.has_active_alert))}>
                      {Math.round(student.latest_weekly_score)}%
                    </p>
                    <p className="text-xs text-neutral-500">Score</p>
                  </div>

                  {/* Streak */}
                  <div className="text-right flex items-center gap-1">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <div>
                      <p className="text-lg font-black text-white">{student.current_streak}</p>
                      <p className="text-xs text-neutral-500">Streak</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap',
                      getRiskBg(student.latest_weekly_score, student.has_active_alert),
                      getRiskColor(student.latest_weekly_score, student.has_active_alert)
                    )}
                  >
                    {getStatusLabel(student)}
                  </div>

                  {/* Ação */}
                  <Eye className="w-5 h-5 text-neutral-500" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal de Detalhes e Mensagens */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center"
            onClick={() => setSelectedStudent(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[80vh] rounded-t-3xl sm:rounded-3xl border border-[#1a1a1a] bg-[#050505] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="border-b border-[#1a1a1a] p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-white">{selectedStudent.aluno_name}</h2>
                    <p className="mt-1 text-sm text-neutral-400">{selectedStudent.aluno_email}</p>
                    {selectedStudent.turma_name && <p className="text-xs text-neutral-500">{selectedStudent.turma_name}</p>}
                  </div>
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="rounded-full p-2 hover:bg-[#1a1a1a] transition-colors"
                  >
                    <X className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>
              </div>

              {/* Métricas */}
              <div className="border-b border-[#1a1a1a] px-6 py-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">Score Semanal</p>
                  <p className={cn('mt-2 text-2xl font-black', getRiskColor(selectedStudent.latest_weekly_score, selectedStudent.has_active_alert))}>
                    {Math.round(selectedStudent.latest_weekly_score)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">Streak Atual</p>
                  <p className="mt-2 text-2xl font-black text-yellow-400">{selectedStudent.current_streak}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">Status</p>
                  <p className="mt-2 text-sm font-semibold text-cyan-400">{getStatusLabel(selectedStudent)}</p>
                </div>
              </div>

              {/* Mensagens/Notas */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-neutral-400" />
                    <h3 className="font-semibold text-white">Mensagens</h3>
                    <span className="text-xs text-neutral-500">({selectedStudent.notes?.length ?? 0})</span>
                  </div>

                  {notesLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                    </div>
                  ) : selectedStudent.notes && selectedStudent.notes.length > 0 ? (
                    <div className="space-y-3">
                      {selectedStudent.notes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-neutral-400">{note.treinador_name || 'Sistema'}</p>
                              <p className="mt-2 text-sm text-neutral-200">{note.content}</p>
                            </div>
                          </div>
                          {note.tags && note.tags.length > 0 && (
                            <div className="mt-3 flex gap-2 flex-wrap">
                              {note.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 text-[10px] font-semibold text-cyan-400"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">Nenhuma mensagem ainda</p>
                  )}
                </div>
              </div>

              {/* Botões de ação */}
              <div className="border-t border-[#1a1a1a] p-6 flex gap-3">
                <button
                  className="flex-1 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 px-4 py-3 font-semibold text-cyan-400 hover:bg-cyan-500/20 transition-all"
                  onClick={() => {
                    // RF50: Navegar para dashboard do aluno
                    navigate(`/alunos/${selectedStudent.aluno_id}/dashboard`);
                  }}
                >
                  Ver Dashboard Completo
                </button>
                <button
                  className="rounded-2xl bg-[#1a1a1a] px-4 py-3 font-semibold text-white hover:bg-[#2a2a2a] transition-all"
                  onClick={() => setSelectedStudent(null)}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
