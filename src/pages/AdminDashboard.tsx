import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive,
  BarChart3,
  CalendarRange,
  GraduationCap,
  Loader2,
  Mail,
  MessageSquare,
  Copy,
  Clock3,
  Edit3,
  Link2,
  Search,
  Shield,
  ShieldCheck,
  TrendingUp,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAdminData } from '../hooks/useData';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import TrainerCharts from '../components/TrainerCharts';
import CoachNotesPanel from '../components/CoachNotesPanel';
import type {
  AdminProgramSummary,
  AdminTurmaMember,
  AdminTurmaSummary,
  CoachNotesStats,
  Enrollment,
  Cycle,
  Profile,
  Program,
  Turma,
} from '../types';

const ROLE_ALIASES: Record<string, string> = {
  admin: 'SUPER_ADMIN',
  coach: 'TREINADOR',
  aluno: 'ALUNO',
};

const ROLE_META: Record<string, { label: string; className: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    className: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
  },
  TREINADOR: {
    label: 'Treinador',
    className: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  },
  PROPRIETARIO_EMPRESA: {
    label: 'Proprietário',
    className: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  },
  ALUNO_GRADUADO: {
    label: 'Aluno Graduado',
    className: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
  },
  ALUNO: {
    label: 'Aluno',
    className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  },
};

const ROLE_OPTIONS = ['SUPER_ADMIN', 'TREINADOR', 'PROPRIETARIO_EMPRESA', 'ALUNO_GRADUADO', 'ALUNO'];

function normalizeRole(role?: string | null) {
  const raw = String(role ?? 'ALUNO').trim();
  return ROLE_ALIASES[raw.toLowerCase()] ?? raw.toUpperCase();
}

function getRoleMeta(role?: string | null) {
  return ROLE_META[normalizeRole(role)] ?? {
    label: normalizeRole(role).replaceAll('_', ' '),
    className: 'bg-[#0a0a0a] border-[#1a1a1a] text-neutral-500',
  };
}

function isProgramArchived(program: Record<string, unknown>) {
  return Boolean(program.archived_at);
}

function isProfileDisabled(profile: Record<string, unknown>) {
  return Boolean(profile.disabled_at);
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { users, programs, turmas, enrollments, cycles, weeklyScores, loading, updateUserRole, fetchUsers, createUserInvite, assignMonitorToEnrollment } = useAdminData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [programCreateMode, setProgramCreateMode] = useState(false);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string | null>(null);
  const [turmaCreateMode, setTurmaCreateMode] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [notesStatsByAluno, setNotesStatsByAluno] = useState<Record<string, CoachNotesStats>>({});
  const [programDraft, setProgramDraft] = useState({ name: '', description: '' });
  const [turmaDraft, setTurmaDraft] = useState({
    program_id: '',
    name: '',
    treinador_id: '',
    fechamento_dia: '1',
    fechamento_hora: '23:59',
    weeks_count: '12',
    start_date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [inviteForm, setInviteForm] = useState({
    full_name: '',
    email: '',
    role: 'ALUNO',
    monitor_limit: '1',
  });
  const [inviteLink, setInviteLink] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [monitorLimitDrafts, setMonitorLimitDrafts] = useState<Record<string, string>>({});
  const [selectedUserRoleDraft, setSelectedUserRoleDraft] = useState<string>('ALUNO');
  const [selectedUserMonitorLimitDraft, setSelectedUserMonitorLimitDraft] = useState<string>('1');

  useEffect(() => {
    if (!selectedTurmaId && turmas.length > 0 && !turmaCreateMode) {
      setSelectedTurmaId(turmas[0].id);
    }
  }, [selectedTurmaId, turmaCreateMode, turmas]);

  useEffect(() => {
    if (!selectedProgramId && programs.length > 0 && !programCreateMode) {
      setSelectedProgramId(programs[0].id);
    }
  }, [programs, programCreateMode, selectedProgramId]);

  useEffect(() => {
    const selectedProgram = programs.find((program: Program) => program.id === selectedProgramId) ?? null;
    if (!selectedProgram) {
      setProgramDraft({ name: '', description: '' });
      return;
    }

    setProgramDraft({
      name: selectedProgram.name ?? '',
      description: selectedProgram.description ?? '',
    });
  }, [programs, selectedProgramId]);

  useEffect(() => {
    const selectedTurma = turmas.find((turma: Turma) => turma.id === selectedTurmaId) ?? null;
    if (!selectedTurma) {
      return;
    }

    setTurmaDraft({
      program_id: selectedTurma.program_id ?? '',
      name: selectedTurma.name ?? '',
      treinador_id: selectedTurma.treinador_id ?? '',
      fechamento_dia: String(selectedTurma.fechamento_dia ?? 1),
      fechamento_hora: selectedTurma.fechamento_hora ?? '23:59',
      weeks_count: String(selectedTurma.weeks_count ?? 12),
      start_date: selectedTurma.start_date ? String(selectedTurma.start_date).slice(0, 10) : format(new Date(), 'yyyy-MM-dd'),
    });
  }, [selectedTurmaId, turmas]);

  useEffect(() => {
    const fetchNotesStats = async () => {
      const { data, error } = await supabase
        .from('coach_notes_stats')
        .select('*');

      if (!error && data) {
        const statsMap = data.reduce<Record<string, CoachNotesStats>>((acc, stat: CoachNotesStats) => {
          acc[stat.aluno_id] = stat;
          return acc;
        }, {});
        setNotesStatsByAluno(statsMap);
      }
    };

    fetchNotesStats();
  }, [users]);

  const profilesById = useMemo(() => {
    return users.reduce<Record<string, any>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [users]);

  const cyclesByTurmaId = useMemo(() => {
    return cycles.reduce<Record<string, Cycle[]>>((acc, cycle) => {
      const key = String(cycle.turma_id ?? '');
      if (!key) return acc;
      acc[key] = acc[key] ?? [];
      acc[key].push(cycle as Cycle);
      return acc;
    }, {});
  }, [cycles]);

  const enrollmentsByTurmaId = useMemo(() => {
    return enrollments.reduce<Record<string, Enrollment[]>>((acc, enrollment) => {
      const key = String(enrollment.turma_id ?? '');
      if (!key) return acc;
      acc[key] = acc[key] ?? [];
      acc[key].push(enrollment as Enrollment);
      return acc;
    }, {});
  }, [enrollments]);

  const programSummaries = useMemo<AdminProgramSummary[]>(() => {
    return programs.map((program: Program) => {
      const programTurmas = turmas.filter((turma: Turma) => turma.program_id === program.id);
      const programEnrollments = programTurmas.flatMap((turma) => enrollmentsByTurmaId[turma.id] ?? []);
      const activeTurmas = programTurmas.filter((turma) => {
        const turmaCycles = cyclesByTurmaId[turma.id] ?? [];
        const hasActiveCycle = turmaCycles.some((cycle) => cycle.status === 'active');
        const hasMembers = (enrollmentsByTurmaId[turma.id] ?? []).length > 0;
        return hasActiveCycle || hasMembers;
      });
      const concludedTurmas = programTurmas.filter((turma) => {
        const turmaCycles = cyclesByTurmaId[turma.id] ?? [];
        return turmaCycles.length > 0 && turmaCycles.every((cycle) => cycle.status === 'archived');
      });

      return {
        program,
        turmasCount: programTurmas.length,
        ongoingTurmas: activeTurmas.length,
        concludedTurmas: concludedTurmas.length,
        totalMembers: programEnrollments.length,
      };
    });
  }, [programs, turmas, enrollmentsByTurmaId, cyclesByTurmaId]);

  const turmaSummaries = useMemo<AdminTurmaSummary[]>(() => {
    return turmas.map((turma: Turma) => {
      const programName = programs.find((program) => program.id === turma.program_id)?.name ?? null;
      const trainerName = profilesById[turma.treinador_id ?? '']?.full_name ?? null;
      const turmaCycles = cyclesByTurmaId[turma.id] ?? [];
      const turmaEnrollments = enrollmentsByTurmaId[turma.id] ?? [];
      const memberCount = turmaEnrollments.length;
      const activeMemberCount = turmaEnrollments.filter((entry) => entry.status === 'active').length;
      const concludedMemberCount = turmaEnrollments.filter((entry) => entry.status === 'concluded').length;
      const ongoingCycleCount = turmaCycles.filter((cycle) => cycle.status === 'active').length;
      const concludedCycleCount = turmaCycles.filter((cycle) => cycle.status === 'archived').length;
      const statusTone: AdminTurmaSummary['statusTone'] =
        ongoingCycleCount > 0 || activeMemberCount > 0 ? 'active' : memberCount > 0 ? 'concluded' : 'draft';
      const statusLabel =
        statusTone === 'active'
          ? 'Em andamento'
          : statusTone === 'concluded'
            ? 'Concluída'
            : 'Planejada';

      // Calcular o score médio da turma
      const turmaCycleIds = turmaCycles.map(c => c.id);
      const turmaWeeklyScores = weeklyScores.filter(ws => turmaCycleIds.includes(ws.cycle_id));
      const averageScore = turmaWeeklyScores.length > 0
        ? Math.round(turmaWeeklyScores.reduce((sum, ws) => sum + (ws.score ?? 0), 0) / turmaWeeklyScores.length)
        : 0;

      // Calcular percentual de alunos em risco (score < 60%)
      const alunoScoresMap = new Map<string, number[]>();
      turmaWeeklyScores.forEach(ws => {
        if (!alunoScoresMap.has(ws.aluno_id)) {
          alunoScoresMap.set(ws.aluno_id, []);
        }
        alunoScoresMap.get(ws.aluno_id)?.push(ws.score ?? 0);
      });

      const riskAlunosCount = Array.from(alunoScoresMap.values()).filter(scores => {
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        return avg < 60;
      }).length;

      const riskPercentage = alunoScoresMap.size > 0
        ? Math.round((riskAlunosCount / alunoScoresMap.size) * 100)
        : 0;

      return {
        turma,
        programName,
        trainerName,
        memberCount,
        activeMemberCount,
        concludedMemberCount,
        ongoingCycleCount,
        concludedCycleCount,
        statusLabel,
        statusTone,
        averageScore,
        riskPercentage,
      };
    });
  }, [turmas, programs, profilesById, cyclesByTurmaId, enrollmentsByTurmaId, weeklyScores]);

  const filteredProgramSummaries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return programSummaries;
    return programSummaries.filter((summary) =>
      summary.program.name.toLowerCase().includes(term) ||
      summary.program.description?.toLowerCase().includes(term) ||
      String(summary.turmasCount).includes(term)
    );
  }, [programSummaries, searchTerm]);

  const filteredTurmaSummaries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return turmaSummaries;
    return turmaSummaries.filter((summary) =>
      summary.turma.name.toLowerCase().includes(term) ||
      summary.programName?.toLowerCase().includes(term) ||
      summary.trainerName?.toLowerCase().includes(term) ||
      summary.statusLabel.toLowerCase().includes(term)
    );
  }, [turmaSummaries, searchTerm]);

  const selectedTurma = useMemo(
    () => {
      if (turmaCreateMode) {
        return null;
      }

      return filteredTurmaSummaries.find((summary) => summary.turma.id === selectedTurmaId) ?? filteredTurmaSummaries[0] ?? null;
    },
    [filteredTurmaSummaries, selectedTurmaId, turmaCreateMode]
  );

  const selectedTurmaMembers = useMemo<AdminTurmaMember[]>(() => {
    if (!selectedTurma) return [];
    const turmaEnrollments = enrollmentsByTurmaId[selectedTurma.turma.id] ?? [];
    return turmaEnrollments.map((enrollment) => {
      const profileRow = profilesById[enrollment.aluno_id ?? ''] ?? null;
      const cycle = (cyclesByTurmaId[selectedTurma.turma.id] ?? []).find(
        (entry) => entry.aluno_id === enrollment.aluno_id
      ) ?? null;
      return {
        enrollment,
        profile: profileRow ? ({ ...profileRow } as Profile) : null,
        cycle,
      };
    });
  }, [selectedTurma, enrollmentsByTurmaId, profilesById, cyclesByTurmaId]);

  const activePrograms = useMemo(
    () => programs.filter((program: Record<string, unknown>) => !isProgramArchived(program)),
    [programs]
  );

  const archivedPrograms = useMemo(
    () => programs.filter((program: Record<string, unknown>) => isProgramArchived(program)),
    [programs]
  );

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment: Enrollment) => enrollment.status === 'active'),
    [enrollments]
  );

  const activeStudentCount = useMemo(() => {
    const ids = new Set<string>();
    activeEnrollments.forEach((enrollment) => {
      if (enrollment.aluno_id) {
        ids.add(enrollment.aluno_id);
      }
    });
    return ids.size;
  }, [activeEnrollments]);

  const activeCycleCount = useMemo(
    () => cycles.filter((cycle: Cycle) => cycle.status === 'active').length,
    [cycles]
  );

  const graduatedMonitors = useMemo(
    () =>
      users.filter((user) => normalizeRole(user.role) === 'ALUNO_GRADUADO' && !isProfileDisabled(user as Record<string, unknown>)),
    [users]
  );

  const monitorUsageById = useMemo(() => {
    return activeEnrollments.reduce<Record<string, number>>((acc, enrollment) => {
      if (!enrollment.monitor_id) return acc;
      acc[enrollment.monitor_id] = (acc[enrollment.monitor_id] ?? 0) + 1;
      return acc;
    }, {});
  }, [activeEnrollments]);

  const stats = useMemo(() => {
    const normalized = users.map((user) => ({
      ...user,
      normalizedRole: normalizeRole(user.role),
    }));
    const counts = normalized.reduce(
      (acc, user) => {
        acc[user.normalizedRole] = (acc[user.normalizedRole] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return [
      {
        label: 'Alunos ativos',
        value: String(activeStudentCount),
        trend: `${counts.ALUNO ?? 0} alunos totais`,
        icon: Users,
      },
      {
        label: 'Turmas ativas',
        value: String(turmaSummaries.filter((summary) => summary.statusTone === 'active').length),
        trend: `${activeCycleCount} ciclos em aberto`,
        icon: CalendarRange,
      },
      {
        label: 'Programas ativos',
        value: String(activePrograms.length),
        trend: `${archivedPrograms.length} arquivados`,
        icon: GraduationCap,
      },
      {
        label: 'Graduados',
        value: String(graduatedMonitors.length),
        trend: `${counts.ALUNO_GRADUADO ?? 0} no banco`,
        icon: ShieldCheck,
      },
      {
        label: 'Novos 30d',
        value: String(normalized.filter((user) => new Date(user.created_at).getTime() >= recentCutoff).length),
        trend: 'cadastros recentes',
        icon: TrendingUp,
      },
      {
        label: 'Super admins',
        value: String(counts.SUPER_ADMIN ?? 0),
        trend: `${counts.TREINADOR ?? 0} treinadores`,
        icon: Shield,
      },
    ];
  }, [users, activeStudentCount, turmaSummaries, activeCycleCount, activePrograms.length, archivedPrograms.length, graduatedMonitors.length]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const role = getRoleMeta(user.role).label.toLowerCase();
      return (
        user.full_name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        role.includes(term)
      );
    });
  }, [searchTerm, users]);

  const selectedProgram = useMemo(
    () => {
      if (programCreateMode) {
        return null;
      }

      return programs.find((program: Program) => program.id === selectedProgramId) ?? null;
    },
    [programCreateMode, programs, selectedProgramId]
  );

  const selectedUserRole = normalizeRole(selectedUser?.role);
  const selectedUserMonitorLimit = asNumber(selectedUser?.monitor_limit ?? selectedUser?.monitorLimit, 1);

  useEffect(() => {
    setSelectedUserRoleDraft(selectedUserRole);
    setSelectedUserMonitorLimitDraft(String(selectedUserMonitorLimit));
  }, [selectedUserRole, selectedUserMonitorLimit]);

  useEffect(() => {
    setMonitorLimitDrafts((current) => {
      const next = { ...current };
      graduatedMonitors.forEach((monitor) => {
        const limit = asNumber((monitor as Record<string, unknown>).monitor_limit, 1);
        if (!next[monitor.id]) {
          next[monitor.id] = String(limit);
        }
      });
      return next;
    });
  }, [graduatedMonitors]);

  const runAction = async (key: string, successMessage: string, task: () => Promise<void>) => {
    setActionBusy(key);
    setActionFeedback(null);

    try {
      await task();
      setActionFeedback({ kind: 'success', message: successMessage });
    } catch (error) {
      setActionFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível concluir a ação.',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const refreshData = async () => {
    await fetchUsers();
  };

  const saveProgram = async () => {
    const name = programDraft.name.trim();
    if (!name) {
      setActionFeedback({ kind: 'error', message: 'Informe um nome para o programa.' });
      return;
    }

    const description = programDraft.description.trim() || null;

    if (selectedProgram) {
      await runAction(`program:update:${selectedProgram.id}`, 'Programa atualizado.', async () => {
        const { error } = await supabase
          .from('programs')
          .update({
            name,
            description,
          })
          .eq('id', selectedProgram.id);

        if (error) throw error;
        await refreshData();
      });
      return;
    }

    await runAction('program:create', 'Programa criado.', async () => {
      const { data, error } = await supabase
        .from('programs')
        .insert({
          name,
          description,
        })
        .select('*')
        .single();

      if (error) throw error;

      setSelectedProgramId((data as Program).id);
      setProgramCreateMode(false);
      await refreshData();
    });
  };

  const toggleProgramArchive = async (program: Record<string, unknown>) => {
    const archivedAt = isProgramArchived(program) ? null : new Date().toISOString();
    await runAction(`program:archive:${program.id as string}`, archivedAt ? 'Programa arquivado.' : 'Programa reativado.', async () => {
      const { error } = await supabase
        .from('programs')
        .update({
          archived_at: archivedAt,
        })
        .eq('id', program.id as string);

      if (error) throw error;
      await refreshData();
    });
  };

  const deleteProgram = async (program: Record<string, unknown>) => {
    const attachedTurmas = turmas.filter((turma: Turma) => turma.program_id === program.id).length;
    if (attachedTurmas > 0) {
      setActionFeedback({
        kind: 'error',
        message: 'Remova ou mova as turmas antes de excluir este programa.',
      });
      return;
    }

    if (!window.confirm('Excluir este programa? Esta ação não pode ser desfeita.')) {
      return;
    }

    await runAction(`program:delete:${program.id as string}`, 'Programa excluído.', async () => {
      const { error } = await supabase.from('programs').delete().eq('id', program.id as string);
      if (error) throw error;
      if (selectedProgramId === program.id) {
      setProgramCreateMode(false);
      setSelectedProgramId(null);
      }
      await refreshData();
    });
  };

  const saveTurma = async () => {
    const name = turmaDraft.name.trim();
    if (!name) {
      setActionFeedback({ kind: 'error', message: 'Informe um nome para a turma.' });
      return;
    }

    const payload = {
      program_id: turmaDraft.program_id || null,
      name,
      treinador_id: turmaDraft.treinador_id || null,
      fechamento_dia: Number(turmaDraft.fechamento_dia),
      fechamento_hora: turmaDraft.fechamento_hora,
      weeks_count: Number(turmaDraft.weeks_count),
      start_date: turmaDraft.start_date,
    };

    if (selectedTurmaId) {
      await runAction(`turma:update:${selectedTurmaId}`, 'Turma atualizada.', async () => {
        const { error } = await supabase.from('turmas').update(payload).eq('id', selectedTurmaId);
        if (error) throw error;
        await refreshData();
      });
      return;
    }

    await runAction('turma:create', 'Turma criada.', async () => {
      const { data, error } = await supabase.from('turmas').insert(payload).select('*').single();
      if (error) throw error;
      setTurmaCreateMode(false);
      setSelectedTurmaId((data as Turma).id);
      await refreshData();
    });
  };

  const closeTurmaWeek = async (turma: Turma) => {
    const activeCycle = cycles.find((cycle: Cycle) => cycle.turma_id === turma.id && cycle.status === 'active');
    if (!activeCycle) {
      setActionFeedback({
        kind: 'error',
        message: 'Esta turma não possui ciclo ativo para fechamento semanal.',
      });
      return;
    }

    await runAction(`turma:close-week:${turma.id}`, 'Semana fechada com sucesso.', async () => {
      const { error } = await supabase.rpc('close_cycle_week', {
        p_cycle_id: activeCycle.id,
        p_closed_at: new Date().toISOString(),
      });

      if (error) throw error;
      await refreshData();
    });
  };

  const updateEnrollmentStatus = async (enrollmentId: string, status: string) => {
    await runAction(`enrollment:status:${enrollmentId}`, 'Status do participante atualizado.', async () => {
      const { error } = await supabase.from('enrollments').update({ status }).eq('id', enrollmentId);
      if (error) throw error;
      await refreshData();
    });
  };

  const updateEnrollmentMonitor = async (enrollmentId: string, monitorId: string | null) => {
    await runAction(`enrollment:monitor:${enrollmentId}`, 'Monitor atualizado.', async () => {
      const { error } = await supabase.rpc('assign_monitor_to_enrollment', {
        p_enrollment_id: enrollmentId,
        p_monitor_id: monitorId,
      });

      if (error) throw error;
      await refreshData();
    });
  };

  const updateUserRoleAndRefresh = async (userId: string, newRole: string) => {
    await runAction(`profile:role:${userId}`, 'Papel atualizado.', async () => {
      const error = await updateUserRole(userId, newRole);
      if (error) throw error;
      await refreshData();
    });
  };

  const updateUserDisabledState = async (user: Record<string, unknown>) => {
    const disabledAt = isProfileDisabled(user) ? null : new Date().toISOString();
    await runAction(`profile:disabled:${user.id as string}`, disabledAt ? 'Usuário desativado.' : 'Usuário reativado.', async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ disabled_at: disabledAt })
        .eq('id', user.id as string);

      if (error) throw error;
      await refreshData();
    });
  };

  const updateMonitorLimit = async (userId: string, limitValue: string) => {
    const limit = Number(limitValue);
    if (!Number.isFinite(limit) || limit < 0) {
      setActionFeedback({ kind: 'error', message: 'Informe um limite válido para o monitor.' });
      return;
    }

    await runAction(`profile:monitor-limit:${userId}`, 'Limite de monitor atualizado.', async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ monitor_limit: limit })
        .eq('id', userId);

      if (error) throw error;
      await refreshData();
    });
  };

  const createProfileInvite = async () => {
    const fullName = inviteForm.full_name.trim();
    const email = inviteForm.email.trim();
    const role = normalizeRole(inviteForm.role);

    if (!fullName || !email) {
      setActionFeedback({ kind: 'error', message: 'Informe nome e e-mail para gerar o convite.' });
      return;
    }

    setInviteBusy(true);
    setActionFeedback(null);

    try {
      const result = await createUserInvite({
        email,
        role,
        full_name: fullName,
        monitor_limit: Number(inviteForm.monitor_limit || 0),
      });

      if (result.error) {
        throw result.error;
      }

      const inviteUrl = `${window.location.origin}/signup?invite_token=${encodeURIComponent(result.data?.token || '')}`;

      setInviteLink(inviteUrl);
      setInviteForm({
        full_name: '',
        email: '',
        role: 'ALUNO',
        monitor_limit: '1',
      });
      setActionFeedback({ kind: 'success', message: 'Convite de perfil gerado.' });
    } catch (error) {
      setActionFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível gerar o convite.',
      });
    } finally {
      setInviteBusy(false);
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
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-emerald-400">
            SUPER ADMIN
          </p>
          <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none mb-2 text-white">
            Centro de Comando
          </h1>
          <p className="text-xs font-bold tracking-[0.2em] text-neutral-500 uppercase">
            Gestão estratégica do ecossistema
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/trainer-dashboard')}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-green/20 bg-brand-green/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-brand-green transition-colors hover:border-brand-green/40 hover:text-brand-green/90"
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard do Treinador
          </button>
          <button
            type="button"
            onClick={() => {
              setProgramCreateMode(true);
              setSelectedProgramId(null);
              setProgramDraft({ name: '', description: '' });
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-[#1a1a1a] bg-[#050505] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-300 transition-colors hover:border-brand-green/40 hover:text-white"
          >
            <Plus className="w-4 h-4" />
            Novo programa
          </button>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="BUSCAR USUÁRIO, EMAIL OU PAPEL..."
              className="bg-[#050505] border border-[#1a1a1a] rounded-xl pl-12 pr-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-brand-green transition-all w-full md:w-64 text-white"
            />
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div
          className={cn(
            'rounded-2xl border px-5 py-4 text-sm',
            actionFeedback.kind === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-100'
          )}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em]">
            {actionFeedback.kind === 'success' ? 'Tudo certo' : 'Atenção'}
          </p>
          <p className="mt-2">{actionFeedback.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-[#050505] rounded-3xl p-8 card-border group hover:bg-[#0a0a0a] transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center group-hover:brand-gradient group-hover:text-black transition-all">
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase text-brand-green">
                {stat.trend}
              </span>
            </div>
            <h3 className="text-sm font-black text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</h3>
            <p className="text-4xl font-black italic tracking-tighter uppercase text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[#1a1a1a] p-8">
            <div>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">
                Programas e Treinamentos
              </h2>
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-neutral-600">
                Programas reais e suas turmas vinculadas
              </p>
            </div>
            <div className="rounded-lg border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-green">
              {activePrograms.length} ativos · {archivedPrograms.length} arquivados
            </div>
          </div>

          <div className="border-b border-[#1a1a1a] p-8">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Programa</p>
                    <h3 className="text-lg font-black uppercase tracking-tighter text-white">
                      {selectedProgram ? 'Editar programa selecionado' : 'Criar novo programa'}
                    </h3>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                      Nome
                    </label>
                    <input
                      value={programDraft.name}
                      onChange={(event) => setProgramDraft((current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-brand-green"
                      placeholder="Ex: Programa de Transformação"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                      Descrição
                    </label>
                    <textarea
                      value={programDraft.description}
                      onChange={(event) => setProgramDraft((current) => ({ ...current, description: event.target.value }))}
                      className="min-h-28 w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-brand-green"
                      placeholder="Descreva o programa para a equipe"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={saveProgram}
                        disabled={actionBusy === 'program:create' || actionBusy === `program:update:${selectedProgram?.id ?? ''}`}
                        className="inline-flex items-center gap-2 rounded-2xl brand-gradient px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98] disabled:opacity-50"
                      >
                        {actionBusy === 'program:create' || actionBusy === `program:update:${selectedProgram?.id ?? ''}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProgramCreateMode(true);
                          setSelectedProgramId(null);
                          setProgramDraft({ name: '', description: '' });
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#1a1a1a] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-brand-green hover:text-white"
                      >
                        <Plus className="h-4 w-4" />
                        Novo
                      </button>
                    </div>

                    {selectedProgram && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleProgramArchive(selectedProgram as Record<string, unknown>)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-[#1a1a1a] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-brand-green hover:text-white"
                        >
                          <Archive className="h-4 w-4" />
                          {isProgramArchived(selectedProgram as Record<string, unknown>) ? 'Reativar' : 'Arquivar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProgram(selectedProgram as Record<string, unknown>)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-rose-300 transition-colors hover:border-rose-500/40 hover:text-rose-200"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">
                  Resumo
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Ativos</p>
                    <p className="mt-2 text-3xl font-black italic text-white">{activePrograms.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Arquivados</p>
                    <p className="mt-2 text-3xl font-black italic text-white">{archivedPrograms.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Turmas</p>
                    <p className="mt-2 text-3xl font-black italic text-white">{turmas.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Alunos ativos</p>
                    <p className="mt-2 text-3xl font-black italic text-white">{activeStudentCount}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-neutral-500">
                  {selectedProgram
                    ? `Você está editando ${selectedProgram.name}.`
                    : 'Selecione um card para editar, arquivar ou excluir um programa sem turmas.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-8 md:grid-cols-2">
            {filteredProgramSummaries.length > 0 ? (
              filteredProgramSummaries.map((summary) => (
                <div
                  key={summary.program.id}
                  className={cn(
                    'rounded-[28px] border p-6 transition-all',
                    selectedProgramId === summary.program.id
                      ? 'border-brand-green/40 bg-brand-green/10'
                      : 'border-[#1a1a1a] bg-[#0a0a0a]'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">
                        Treinamento
                      </p>
                      <h3 className="mt-2 text-xl font-black italic uppercase tracking-tighter text-white">
                        {summary.program.name}
                      </h3>
                      <p className="mt-2 text-sm text-neutral-500">
                        {summary.program.description || 'Sem descrição cadastrada.'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={cn(
                          'rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-widest',
                          isProgramArchived(summary.program as Record<string, unknown>)
                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                            : 'border-brand-green/20 bg-brand-green/10 text-brand-green'
                        )}
                      >
                        {isProgramArchived(summary.program as Record<string, unknown>) ? 'Arquivado' : 'Ativo'}
                      </span>
                      <span className="rounded-lg border border-brand-green/20 bg-brand-green/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-brand-green">
                        {summary.turmasCount} turma(s)
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Em andamento</p>
                      <p className="mt-2 text-lg font-black italic text-white">{summary.ongoingTurmas}</p>
                    </div>
                    <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Concluídas</p>
                      <p className="mt-2 text-lg font-black italic text-white">{summary.concludedTurmas}</p>
                    </div>
                    <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Membros</p>
                      <p className="mt-2 text-lg font-black italic text-white">{summary.totalMembers}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProgramCreateMode(false);
                        setSelectedProgramId(summary.program.id);
                        setProgramDraft({
                          name: summary.program.name ?? '',
                          description: summary.program.description ?? '',
                        });
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#1a1a1a] px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-brand-green hover:text-white"
                    >
                      <Edit3 className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleProgramArchive(summary.program as Record<string, unknown>)}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#1a1a1a] px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-brand-green hover:text-white"
                    >
                      <Archive className="h-4 w-4" />
                      {isProgramArchived(summary.program as Record<string, unknown>) ? 'Reativar' : 'Arquivar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProgram(summary.program as Record<string, unknown>)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-300 transition-colors hover:border-rose-500/40 hover:text-rose-200"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-[#1a1a1a] bg-[#0a0a0a] p-8 text-neutral-500 md:col-span-2">
                Nenhum programa cadastrado.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[#1a1a1a] p-8">
            <div>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">
                Turmas
              </h2>
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-neutral-600">
                Clique em uma turma para ver os membros
              </p>
            </div>
            <div className="rounded-lg border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-green">
              {filteredTurmaSummaries.length} turmas
            </div>
          </div>

          <div className="space-y-3 p-8">
            {filteredTurmaSummaries.length > 0 ? (
              filteredTurmaSummaries.map((summary) => {
                const isSelected = selectedTurma?.turma.id === summary.turma.id;
                return (
                    <button
                    key={summary.turma.id}
                    onClick={() => {
                      setTurmaCreateMode(false);
                      setSelectedTurmaId(summary.turma.id);
                    }}
                    className={cn(
                      'w-full rounded-[24px] border p-5 text-left transition-all',
                      isSelected
                        ? 'border-brand-green/40 bg-brand-green/10'
                        : 'border-[#1a1a1a] bg-[#0a0a0a] hover:border-brand-green/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">
                          {summary.programName || 'Sem programa'}
                        </p>
                        <h3 className="mt-2 text-lg font-black italic uppercase tracking-tighter text-white">
                          {summary.turma.name}
                        </h3>
                        <p className="mt-2 text-xs text-neutral-500">
                          {summary.trainerName ? `Treinador: ${summary.trainerName}` : 'Sem treinador definido'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-widest',
                          summary.statusTone === 'active'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : summary.statusTone === 'concluded'
                              ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                              : 'border-[#1a1a1a] bg-[#050505] text-neutral-500'
                        )}
                      >
                        {summary.statusLabel}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-3">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Membros</p>
                        <p className="mt-2 text-lg font-black italic text-white">{summary.memberCount}</p>
                      </div>
                      <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-3">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Ativos</p>
                        <p className="mt-2 text-lg font-black italic text-white">{summary.activeMemberCount}</p>
                      </div>
                      <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-3">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Ciclos</p>
                        <p className="mt-2 text-lg font-black italic text-white">{summary.ongoingCycleCount + summary.concludedCycleCount}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                      <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-3">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Score Médio</p>
                        <p className={cn(
                          'mt-2 text-lg font-black italic',
                          summary.averageScore >= 70 ? 'text-emerald-400' :
                          summary.averageScore >= 50 ? 'text-amber-400' :
                          'text-rose-400'
                        )}>
                          {summary.averageScore}%
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-3">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Em Risco</p>
                        <p className={cn(
                          'mt-2 text-lg font-black italic',
                          summary.riskPercentage <= 10 ? 'text-emerald-400' :
                          summary.riskPercentage <= 30 ? 'text-amber-400' :
                          'text-rose-400'
                        )}>
                          {summary.riskPercentage}%
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[28px] border border-dashed border-[#1a1a1a] bg-[#0a0a0a] p-8 text-neutral-500">
                Nenhuma turma cadastrada.
              </div>
            )}
          </div>

          <div className="border-t border-[#1a1a1a] p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">
              {turmaCreateMode ? 'Nova turma' : selectedTurma ? 'Membros da turma' : 'Selecione uma turma'}
            </h3>
            <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-neutral-600">
              {turmaCreateMode
                ? 'Preencha os campos para criar uma nova turma'
                : selectedTurma
                ? `Participantes vinculados à turma ${selectedTurma.turma.name}`
                : 'A lista de membros aparece ao clicar em uma turma'}
            </p>
            {selectedTurma && (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/turma/${selectedTurma.turma.id}`)}
                  className="inline-flex items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green transition-colors hover:border-brand-green/40 hover:text-brand-green/90"
                >
                  Abrir página dedicada
                </button>
                <button
                  type="button"
                  onClick={() => closeTurmaWeek(selectedTurma.turma)}
                  disabled={actionBusy === `turma:close-week:${selectedTurma.turma.id}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-[#1a1a1a] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-brand-green/40 hover:text-white disabled:opacity-50"
                >
                  {actionBusy === `turma:close-week:${selectedTurma.turma.id}` ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Clock3 className="mr-2 h-4 w-4" />
                  )}
                  Fechar semana
                </button>
              </div>
            )}
          </div>
              {selectedTurma && (
                <span className="rounded-lg border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-green">
                  {selectedTurmaMembers.length} membros
                </span>
              )}
            </div>

            {selectedTurma ? (
              <div className="space-y-6">
                <div className="rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Turma</p>
                      <h4 className="mt-1 text-xl font-black uppercase tracking-tighter text-white">
                        {selectedTurma.turma.name}
                      </h4>
                      <p className="mt-2 text-xs text-neutral-500">
                        {selectedTurma.programName || 'Sem programa'} · {selectedTurma.trainerName || 'Sem treinador'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={saveTurma}
                      disabled={actionBusy === `turma:update:${selectedTurma.turma.id}`}
                      className="inline-flex items-center gap-2 rounded-2xl brand-gradient px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98] disabled:opacity-50"
                    >
                      {actionBusy === `turma:update:${selectedTurma.turma.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar turma
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Programa
                      </label>
                      <select
                        value={turmaDraft.program_id}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, program_id: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      >
                        <option value="">Sem programa</option>
                        {programs.map((program: Program) => (
                          <option key={program.id} value={program.id}>
                            {program.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Nome
                      </label>
                      <input
                        value={turmaDraft.name}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, name: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Treinador
                      </label>
                      <select
                        value={turmaDraft.treinador_id}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, treinador_id: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      >
                        <option value="">Sem treinador</option>
                        {users
                          .filter((candidate) => {
                            const role = normalizeRole(candidate.role);
                            return role === 'TREINADOR' || role === 'SUPER_ADMIN';
                          })
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.full_name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Fechamento do dia
                      </label>
                      <select
                        value={turmaDraft.fechamento_dia}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, fechamento_dia: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      >
                        <option value="0">Domingo</option>
                        <option value="1">Segunda</option>
                        <option value="2">Terça</option>
                        <option value="3">Quarta</option>
                        <option value="4">Quinta</option>
                        <option value="5">Sexta</option>
                        <option value="6">Sábado</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Fechamento da hora
                      </label>
                      <input
                        type="time"
                        value={turmaDraft.fechamento_hora}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, fechamento_hora: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Semanas
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={turmaDraft.weeks_count}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, weeks_count: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Início do ciclo
                      </label>
                      <input
                        type="date"
                        value={turmaDraft.start_date}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, start_date: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTurmaCreateMode(true);
                        setSelectedTurmaId(null);
                        setTurmaDraft({
                          program_id: activePrograms[0]?.id ?? '',
                          name: '',
                          treinador_id: '',
                          fechamento_dia: '1',
                          fechamento_hora: '23:59',
                          weeks_count: '12',
                          start_date: format(new Date(), 'yyyy-MM-dd'),
                        });
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#1a1a1a] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-brand-green hover:text-white"
                    >
                      <Plus className="h-4 w-4" />
                      Nova turma
                    </button>
                    <button
                      type="button"
                      onClick={saveTurma}
                      disabled={actionBusy === `turma:update:${selectedTurma.turma.id}` || actionBusy === 'turma:create'}
                      className="inline-flex items-center gap-2 rounded-2xl border border-brand-green/20 bg-brand-green/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green transition-colors hover:border-brand-green/40 hover:text-brand-green/90 disabled:opacity-50"
                    >
                      {actionBusy === `turma:update:${selectedTurma.turma.id}` || actionBusy === 'turma:create' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Atualizar dados
                    </button>
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">
                        Participantes
                      </p>
                      <h4 className="mt-1 text-xl font-black uppercase tracking-tighter text-white">
                        Monitoramento e status
                      </h4>
                    </div>
                    <span className="rounded-lg border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-green">
                      {selectedTurmaMembers.length} membros
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedTurmaMembers.length > 0 ? (
                      selectedTurmaMembers.map((member) => {
                        const profileRow = member.profile;
                        const activeMonitorId = member.enrollment.monitor_id ?? '';
                        const monitorLimitLabel = profileRow
                          ? `${monitorUsageById[profileRow.id] ?? 0}/${asNumber((profileRow as Record<string, unknown>).monitor_limit, 1)}`
                          : null;

                        return (
                          <div
                            key={member.enrollment.id}
                            className="grid gap-3 rounded-[22px] border border-[#1a1a1a] bg-[#050505] p-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]"
                          >
                            <div>
                              <p className="text-sm font-black uppercase tracking-tight text-white">
                                {profileRow?.full_name || 'Sem nome'}
                              </p>
                              <p className="mt-1 text-[10px] font-mono text-neutral-500">
                                {profileRow?.email || 'sem e-mail'}
                              </p>
                              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
                                {member.cycle?.status === 'archived' ? 'ciclo concluído' : member.cycle?.status === 'active' ? 'ciclo ativo' : 'sem ciclo'}
                              </p>
                            </div>
                            <div>
                              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                                Status
                              </label>
                              <select
                                value={member.enrollment.status || 'inactive'}
                                onChange={(event) => updateEnrollmentStatus(member.enrollment.id, event.target.value)}
                                className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] outline-none focus:border-brand-green"
                              >
                                <option value="active">Ativo</option>
                                <option value="inactive">Inativo</option>
                                <option value="concluded">Concluído</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                                Monitor
                              </label>
                              <select
                                value={activeMonitorId}
                                onChange={(event) => updateEnrollmentMonitor(member.enrollment.id, event.target.value || null)}
                                className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] outline-none focus:border-brand-green"
                              >
                                <option value="">Sem monitor</option>
                                {graduatedMonitors.map((monitor) => (
                                  <option key={monitor.id} value={monitor.id}>
                                    {monitor.full_name}
                                  </option>
                                ))}
                              </select>
                              {profileRow && (
                                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
                                  Limite do monitor: {monitorLimitLabel}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-[28px] border border-dashed border-[#1a1a1a] bg-[#0a0a0a] p-8 text-neutral-500">
                        Nenhum membro vinculado a esta turma.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : turmaCreateMode ? (
              <div className="space-y-6">
                <div className="rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Nova turma</p>
                      <h4 className="mt-1 text-xl font-black uppercase tracking-tighter text-white">
                        Configurar turma
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={saveTurma}
                      disabled={actionBusy === 'turma:create'}
                      className="inline-flex items-center gap-2 rounded-2xl brand-gradient px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98]"
                    >
                      {actionBusy === 'turma:create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Criar turma
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Programa
                      </label>
                      <select
                        value={turmaDraft.program_id}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, program_id: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      >
                        <option value="">Sem programa</option>
                        {programs.map((program: Program) => (
                          <option key={program.id} value={program.id}>
                            {program.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Nome
                      </label>
                      <input
                        value={turmaDraft.name}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, name: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Treinador
                      </label>
                      <select
                        value={turmaDraft.treinador_id}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, treinador_id: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      >
                        <option value="">Sem treinador</option>
                        {users
                          .filter((candidate) => {
                            const role = normalizeRole(candidate.role);
                            return role === 'TREINADOR' || role === 'SUPER_ADMIN';
                          })
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.full_name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Fechamento do dia
                      </label>
                      <select
                        value={turmaDraft.fechamento_dia}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, fechamento_dia: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      >
                        <option value="0">Domingo</option>
                        <option value="1">Segunda</option>
                        <option value="2">Terça</option>
                        <option value="3">Quarta</option>
                        <option value="4">Quinta</option>
                        <option value="5">Sexta</option>
                        <option value="6">Sábado</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Fechamento da hora
                      </label>
                      <input
                        type="time"
                        value={turmaDraft.fechamento_hora}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, fechamento_hora: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Semanas
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={turmaDraft.weeks_count}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, weeks_count: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Início do ciclo
                      </label>
                      <input
                        type="date"
                        value={turmaDraft.start_date}
                        onChange={(event) => setTurmaDraft((current) => ({ ...current, start_date: event.target.value }))}
                        className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTurmaCreateMode(false);
                        setSelectedTurmaId(turmas[0]?.id ?? null);
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#1a1a1a] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-brand-green hover:text-white"
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-[#1a1a1a] bg-[#0a0a0a] p-8 text-neutral-500">
                Nenhuma turma selecionada.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Nova seção de gráficos da turma */}
      {selectedTurma && (
        <section className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">
                Análise de Performance da Turma
              </h2>
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-neutral-600">
                Gráficos de evolução semanal de scores
              </p>
            </div>
            <button
              onClick={() => setShowCharts(!showCharts)}
              className="rounded-lg border border-brand-green/20 bg-brand-green/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-green hover:border-brand-green/40 transition-all"
            >
              {showCharts ? 'Ocultar Gráficos' : 'Mostrar Gráficos'}
            </button>
          </div>

          {showCharts && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <TrainerCharts turmaId={selectedTurmaId} />
            </motion.div>
          )}
        </section>
      )}

      <div className="bg-[#050505] rounded-[32px] card-border overflow-hidden">
        <div className="p-8 border-b border-[#1a1a1a] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">
              Gestão de Perfis
            </h2>
            <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-600 mt-2">
              Dados reais vindos da tabela `profiles`
            </p>
          </div>
          <div className="px-3 py-1 bg-brand-green/10 border border-brand-green/20 text-brand-green text-[10px] font-black uppercase tracking-widest rounded-lg">
            {users.length} PERFIS
          </div>
        </div>

        <div className="border-b border-[#1a1a1a] p-8">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">
                    Novo usuário
                  </p>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-white">
                    Convite e perfil
                  </h3>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                    Nome completo
                  </label>
                  <input
                    value={inviteForm.full_name}
                    onChange={(event) => setInviteForm((current) => ({ ...current, full_name: event.target.value }))}
                    className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                    placeholder="Ex: Fábio Morales"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                    placeholder="novo@exemplo.com"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                    Papel
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}
                    className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {getRoleMeta(role).label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                    Limite de monitor
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={inviteForm.monitor_limit}
                    onChange={(event) => setInviteForm((current) => ({ ...current, monitor_limit: event.target.value }))}
                    disabled={normalizeRole(inviteForm.role) !== 'ALUNO_GRADUADO'}
                    className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-brand-green disabled:cursor-not-allowed disabled:opacity-40"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={createProfileInvite}
                  disabled={inviteBusy}
                  className="inline-flex items-center gap-2 rounded-2xl brand-gradient px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98] disabled:opacity-50"
                >
                  {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Gerar convite
                </button>
                {inviteLink && (
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(inviteLink);
                      setActionFeedback({ kind: 'success', message: 'Link do convite copiado.' });
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#1a1a1a] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-brand-green hover:text-white"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar link
                  </button>
                )}
              </div>

              {inviteLink && (
                <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">
                    Convite criado
                  </p>
                  <p className="mt-2 break-all text-sm text-emerald-50/90">{inviteLink}</p>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">
                Resumo de perfis
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Ativos</p>
                  <p className="mt-2 text-3xl font-black italic text-white">
                    {filteredUsers.filter((user) => !isProfileDisabled(user as Record<string, unknown>)).length}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Desativados</p>
                  <p className="mt-2 text-3xl font-black italic text-white">
                    {filteredUsers.filter((user) => isProfileDisabled(user as Record<string, unknown>)).length}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Graduados</p>
                  <p className="mt-2 text-3xl font-black italic text-white">{graduatedMonitors.length}</p>
                </div>
                <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Monitorados</p>
                  <p className="mt-2 text-3xl font-black italic text-white">
                    {Object.values(monitorUsageById).reduce<number>((sum, value) => sum + Number(value), 0)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                O fluxo de convite alimenta a página de signup com token e o perfil nasce já no papel certo quando o RPC estiver ativo.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0a0a0a]">
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Usuário</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Status</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Papel</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Cadastro</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Monitor</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Notas</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {filteredUsers.map((user) => {
                const roleMeta = getRoleMeta(user.role);
                const membershipAge = formatDistanceToNowStrict(new Date(user.created_at), { locale: ptBR });
                const disabled = isProfileDisabled(user as Record<string, unknown>);
                const monitorLimit = asNumber((user as Record<string, unknown>).monitor_limit, 1);
                const activeMonitorLoad = monitorUsageById[user.id] ?? 0;

                return (
                  <tr
                    key={user.id}
                    className="group hover:bg-[#0a0a0a] transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedUser(user);
                      setSelectedUserRoleDraft(normalizeRole(user.role));
                      setSelectedUserMonitorLimitDraft(String(monitorLimit));
                    }}
                  >
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center font-black text-white text-xs">
                          {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase text-white tracking-tight leading-none mb-1">
                            {user.full_name || 'Anônimo'}
                          </p>
                          <p className="text-[10px] text-neutral-600 font-mono flex items-center gap-1">
                            <Mail className="w-2 h-2" /> {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span
                        className={cn(
                          'rounded-lg border px-2 py-1 text-[8px] font-black uppercase tracking-widest',
                          disabled
                            ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                        )}
                      >
                        {disabled ? 'Desativado' : 'Ativo'}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={cn('px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border', roleMeta.className)}>
                        {roleMeta.label}
                      </span>
                    </td>
                    <td className="p-6 text-[10px] font-mono text-neutral-500">
                      <span className="block">{format(new Date(user.created_at), 'dd/MM/yyyy')}</span>
                      <span className="block text-neutral-700">há {membershipAge}</span>
                    </td>
                    <td className="p-6 text-[10px] font-mono text-neutral-500">
                      <span className="block">{activeMonitorLoad}/{monitorLimit}</span>
                      <span className="block text-neutral-700 uppercase tracking-[0.2em]">
                        {normalizeRole(user.role) === 'ALUNO_GRADUADO' ? 'Graduado monitor' : 'Sem limite'}
                      </span>
                    </td>
                    <td className="p-6">
                      {(function() {
                        const stats = notesStatsByAluno[user.id];
                        if (!stats || stats.total_notes === 0) {
                          return <span className="text-[8px] text-neutral-700 font-mono">-</span>;
                        }
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] text-neutral-500 font-mono">{stats.total_notes}</span>
                            {stats.unread_notes > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-400">
                                <MessageSquare className="w-3 h-3" />
                                {stats.unread_notes}
                              </span>
                            )}
                            {stats.recent_notes_24h > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-brand-green/20 bg-brand-green/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-brand-green">
                                NOVA
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-6 text-right space-y-2" onClick={(event) => event.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <select
                          value={normalizeRole(user.role)}
                          onChange={(event) => {
                            event.stopPropagation();
                            void updateUserRoleAndRefresh(user.id, event.target.value);
                          }}
                          className="bg-[#050505] border border-[#1a1a1a] rounded-lg px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-500 outline-none focus:border-brand-green"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {getRoleMeta(role).label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void updateUserDisabledState(user as Record<string, unknown>);
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-[8px] font-black uppercase tracking-widest text-neutral-500 transition-colors hover:border-brand-green hover:text-white"
                        >
                          {disabled ? <UserPlus className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                          {disabled ? 'Reativar' : 'Desativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center">
              <Search className="w-12 h-12 text-neutral-900 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-700">
                Nenhum perfil encontrado
              </p>
              <p className="text-[10px] uppercase tracking-widest text-neutral-700 mt-3 max-w-md">
                Não há correspondência para o filtro atual. Se esperava ver perfis aqui, verifique se a
                tabela `profiles` está respondendo no banco de dev.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-[#1a1a1a] p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">
                Graduados
              </p>
              <h3 className="mt-2 text-2xl font-black italic uppercase tracking-tighter text-white">
                Monitoramento por limite
              </h3>
            </div>
            <div className="rounded-lg border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-green">
              {graduatedMonitors.length} monitor(es)
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {graduatedMonitors.length > 0 ? (
              graduatedMonitors.map((monitor) => {
                const monitorLimit = monitorLimitDrafts[monitor.id] ?? String(asNumber((monitor as Record<string, unknown>).monitor_limit, 1));
                const monitorLoad = monitorUsageById[monitor.id] ?? 0;

                return (
                  <div
                    key={monitor.id}
                    className="rounded-[24px] border border-[#1a1a1a] bg-[#0a0a0a] p-5"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
                      <div>
                        <p className="text-sm font-black uppercase tracking-tight text-white">
                          {monitor.full_name}
                        </p>
                        <p className="mt-1 text-[10px] font-mono text-neutral-500">{monitor.email}</p>
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
                          {monitorLoad} alunos monitorados
                        </p>
                      </div>
                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                          Limite
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={monitorLimit}
                          onChange={(event) =>
                            setMonitorLimitDrafts((current) => ({
                              ...current,
                              [monitor.id]: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-3 text-sm font-mono outline-none focus:border-brand-green"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => void updateMonitorLimit(monitor.id, monitorLimit)}
                          className="inline-flex items-center gap-2 rounded-2xl brand-gradient px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98]"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Salvar limite
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[28px] border border-dashed border-[#1a1a1a] bg-[#050505] p-8 text-neutral-500">
                Nenhum graduado disponível para monitoramento.
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#050505] border border-[#1a1a1a] rounded-[32px] overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-[#1a1a1a] flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                    {selectedUser.full_name}
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">{selectedUser.email}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={cn('px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border', getRoleMeta(selectedUser.role).className)}>
                      {getRoleMeta(selectedUser.role).label}
                    </span>
                    <span className="px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border border-[#1a1a1a] text-neutral-500">
                      {formatDistanceToNowStrict(new Date(selectedUser.created_at), { locale: ptBR })} de cadastro
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-10 h-10 rounded-full border border-[#1a1a1a] flex items-center justify-center hover:bg-[#0a0a0a]"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="border-b border-[#1a1a1a] p-8 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[24px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Papel</p>
                  <select
                    value={selectedUserRoleDraft}
                    onChange={(event) => setSelectedUserRoleDraft(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] outline-none focus:border-brand-green"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {getRoleMeta(role).label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void updateUserRoleAndRefresh(selectedUser.id, selectedUserRoleDraft)}
                    className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-brand-green/20 bg-brand-green/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green transition-colors hover:border-brand-green/40 hover:text-brand-green/90"
                  >
                    <Save className="h-4 w-4" />
                    Salvar papel
                  </button>
                </div>

                <div className="rounded-[24px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Monitor</p>
                  <input
                    type="number"
                    min="0"
                    value={selectedUserMonitorLimitDraft}
                    onChange={(event) => setSelectedUserMonitorLimitDraft(event.target.value)}
                    disabled={selectedUserRoleDraft !== 'ALUNO_GRADUADO'}
                    className="mt-3 w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-3 text-sm font-mono outline-none focus:border-brand-green disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={() => void updateMonitorLimit(selectedUser.id, selectedUserMonitorLimitDraft)}
                    disabled={selectedUserRoleDraft !== 'ALUNO_GRADUADO'}
                    className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[#1a1a1a] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-brand-green hover:text-white disabled:opacity-40"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Atualizar limite
                  </button>
                </div>

                <div className="rounded-[24px] border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Status</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <span
                      className={cn(
                        'rounded-lg border px-2 py-1 text-[8px] font-black uppercase tracking-widest',
                        isProfileDisabled(selectedUser as Record<string, unknown>)
                          ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                      )}
                    >
                      {isProfileDisabled(selectedUser as Record<string, unknown>) ? 'Desativado' : 'Ativo'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void updateUserDisabledState(selectedUser as Record<string, unknown>)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#1a1a1a] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-brand-green hover:text-white"
                    >
                      {isProfileDisabled(selectedUser as Record<string, unknown>) ? <UserPlus className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                      {isProfileDisabled(selectedUser as Record<string, unknown>) ? 'Reativar' : 'Desativar'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <CoachNotesPanel
                  aluno={selectedUser}
                  treinador={profile}
                  onClose={() => setSelectedUser(null)}
                />
              </div>

              <div className="p-8 border-t border-[#1a1a1a] bg-[#030303]">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-full py-4 border border-[#1a1a1a] rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-neutral-900 transition-all flex items-center justify-center gap-2"
                >
                  Fechar detalhes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
