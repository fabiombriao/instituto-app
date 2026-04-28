import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCopy,
  ChevronRight,
  Loader2,
  Plus,
  Send,
  Settings2,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addDays, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatTurmaInviteLabel } from '../lib/turmaLabel';
import type {
  AdminTurmaMember,
  Cycle,
  Enrollment,
  Profile,
  Program,
  Turma,
  TurmaInvite,
} from '../types';

export default function TurmaSetup() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [invites, setInvites] = useState<TurmaInvite[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [turmaName, setTurmaName] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [newProgramName, setNewProgramName] = useState('');
  const [fechamentoDia, setFechamentoDia] = useState('1');
  const [fechamentoHora, setFechamentoHora] = useState('23:59');
  const [weeksCount, setWeeksCount] = useState('12');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteType, setInviteType] = useState<'link' | 'email'>('link');
  const [inviteUrl, setInviteUrl] = useState('');
  const [currentInvite, setCurrentInvite] = useState<TurmaInvite | null>(null);

  const canManage = profile?.role === 'TREINADOR' || profile?.role === 'SUPER_ADMIN';
  const selectedTurma = useMemo(
    () => turmas.find((turma) => turma.id === selectedTurmaId) ?? null,
    [selectedTurmaId, turmas]
  );
  const profilesById = useMemo(() => {
    return profiles.reduce<Record<string, Profile>>((acc, current) => {
      acc[current.id] = current;
      return acc;
    }, {});
  }, [profiles]);
  const enrollmentsByTurmaId = useMemo(() => {
    return enrollments.reduce<Record<string, Enrollment[]>>((acc, current) => {
      if (!current.turma_id) return acc;
      acc[current.turma_id] = acc[current.turma_id] ?? [];
      acc[current.turma_id].push(current);
      return acc;
    }, {});
  }, [enrollments]);
  const cyclesByTurmaId = useMemo(() => {
    return cycles.reduce<Record<string, Cycle[]>>((acc, current) => {
      if (!current.turma_id) return acc;
      acc[current.turma_id] = acc[current.turma_id] ?? [];
      acc[current.turma_id].push(current);
      return acc;
    }, {});
  }, [cycles]);
  const turmaSummaries = useMemo(() => {
    return turmas.map((turma) => {
      const programName = programs.find((program) => program.id === turma.program_id)?.name ?? null;
      const trainerName = profilesById[turma.treinador_id ?? '']?.full_name ?? null;
      const turmaCycles = cyclesByTurmaId[turma.id] ?? [];
      const turmaEnrollments = enrollmentsByTurmaId[turma.id] ?? [];
      const memberCount = turmaEnrollments.length;
      const activeMemberCount = turmaEnrollments.filter((enrollment) => enrollment.status === 'active').length;
      const concludedMemberCount = turmaEnrollments.filter((enrollment) => enrollment.status === 'concluded').length;
      const ongoingCycleCount = turmaCycles.filter((cycle) => cycle.status === 'active').length;
      const concludedCycleCount = turmaCycles.filter((cycle) => cycle.status === 'archived').length;
      const statusTone: 'draft' | 'active' | 'concluded' =
        ongoingCycleCount > 0 || activeMemberCount > 0
          ? 'active'
          : concludedCycleCount > 0 || concludedMemberCount > 0
            ? 'concluded'
            : 'draft';
      const statusLabel =
        statusTone === 'active'
          ? 'Em andamento'
          : statusTone === 'concluded'
            ? 'Concluída'
            : 'Rascunho';

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
      };
    });
  }, [turmas, programs, profilesById, enrollmentsByTurmaId, cyclesByTurmaId]);
  const selectedTurmaSummary = useMemo(
    () => turmaSummaries.find((summary) => summary.turma.id === selectedTurmaId) ?? turmaSummaries[0] ?? null,
    [turmaSummaries, selectedTurmaId]
  );
  const selectedTurmaNumber = useMemo(() => {
    if (!selectedTurmaSummary) return null;

    const sameProgramTurmas = turmas
      .filter((turma) => turma.program_id === selectedTurmaSummary.turma.program_id)
      .slice()
      .sort((left, right) => left.created_at.localeCompare(right.created_at));

    const position = sameProgramTurmas.findIndex((turma) => turma.id === selectedTurmaSummary.turma.id);
    return position >= 0 ? position + 1 : null;
  }, [selectedTurmaSummary, turmas]);
  const selectedTurmaInviteLabel = useMemo(() => {
    if (!selectedTurmaSummary) return 'Turma';

    return formatTurmaInviteLabel(selectedTurmaSummary.turma.name, {
      programName: selectedTurmaSummary.programName,
      turmaNumber: selectedTurmaNumber,
      mode: 'standard',
    });
  }, [selectedTurmaSummary, selectedTurmaNumber]);
  const selectedTurmaMembers = useMemo<AdminTurmaMember[]>(() => {
    if (!selectedTurmaSummary) return [];

    const turmaId = selectedTurmaSummary.turma.id;
    const turmaEnrollments = enrollmentsByTurmaId[turmaId] ?? [];
    const turmaCycles = cyclesByTurmaId[turmaId] ?? [];

    return turmaEnrollments
      .slice()
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map((enrollment) => {
        const matchingCycles = turmaCycles
          .filter((cycle) => cycle.aluno_id === enrollment.aluno_id)
          .slice()
          .sort((left, right) => right.created_at.localeCompare(left.created_at));

        return {
          enrollment,
          profile: enrollment.aluno_id ? profilesById[enrollment.aluno_id] ?? null : null,
          cycle: matchingCycles[0] ?? null,
        };
      });
  }, [selectedTurmaSummary, enrollmentsByTurmaId, cyclesByTurmaId, profilesById]);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const turmasQuery =
        profile?.role === 'SUPER_ADMIN'
          ? supabase.from('turmas').select('*').order('created_at', { ascending: false })
          : supabase
              .from('turmas')
              .select('*')
              .eq('treinador_id', user.id)
              .order('created_at', { ascending: false });

      const [profilesResult, programsResult, turmasResult, enrollmentsResult, cyclesResult] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('programs').select('*').order('created_at', { ascending: true }),
        turmasQuery,
        supabase.from('enrollments').select('*').order('created_at', { ascending: false }),
        supabase.from('cycles').select('*').order('created_at', { ascending: false }),
      ]);

      if (!mounted) return;

      if (profilesResult.error) {
        setError('Não foi possível carregar os perfis.');
      } else {
        setProfiles((profilesResult.data ?? []) as Profile[]);
      }

      if (programsResult.error) {
        setError('Não foi possível carregar os programas.');
      } else {
        setPrograms((programsResult.data ?? []) as Program[]);
      }

      if (turmasResult.error) {
        setError('Não foi possível carregar as turmas.');
      } else {
        const rows = (turmasResult.data ?? []) as Turma[];
        setTurmas(rows);
        if (rows[0]?.id) {
          setSelectedTurmaId(rows[0].id);
        }
      }

      if (enrollmentsResult.error) {
        setError('Não foi possível carregar os membros das turmas.');
      } else {
        setEnrollments((enrollmentsResult.data ?? []) as Enrollment[]);
      }

      if (cyclesResult.error) {
        setError('Não foi possível carregar os ciclos das turmas.');
      } else {
        setCycles((cyclesResult.data ?? []) as Cycle[]);
      }

      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user, profile?.role]);

  useEffect(() => {
    if (!selectedTurmaId) return;

    let mounted = true;

    const loadInvites = async () => {
      const { data, error } = await supabase
        .from('turma_invites')
        .select('*')
        .eq('turma_id', selectedTurmaId)
        .order('created_at', { ascending: false });

      if (!mounted) return;

      if (error) {
        setError('Não foi possível carregar os convites desta turma.');
        setInvites([]);
      } else {
        setInvites((data ?? []) as TurmaInvite[]);
      }
    };

    void loadInvites();

    return () => {
      mounted = false;
    };
  }, [selectedTurmaId]);

  const ensureProgram = async () => {
    if (selectedProgramId) return selectedProgramId;
    if (!newProgramName.trim()) {
      throw new Error('Escolha um programa existente ou informe um novo nome.');
    }

    const { data, error } = await supabase
      .from('programs')
      .insert({ name: newProgramName.trim(), description: null })
      .select('*')
      .single();
    if (error) throw error;

    setPrograms((current) => [...current, data as Program]);
    setSelectedProgramId(data.id);
    return data.id;
  };

  const handleCreateTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canManage) return;
    if (!turmaName.trim()) {
      setError('Informe um nome para a turma.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const programId = await ensureProgram();
      const { data, error } = await supabase
        .from('turmas')
        .insert({
          program_id: programId,
          name: turmaName.trim(),
          treinador_id: user.id,
          fechamento_dia: Number(fechamentoDia),
          fechamento_hora: fechamentoHora,
          weeks_count: Number(weeksCount),
          start_date: startDate,
        })
        .select('*')
        .single();

      if (error) throw error;

      setTurmas((current) => [data as Turma, ...current]);
      setSelectedTurmaId(data.id);
      setTurmaName('');
    } catch (creationError) {
      setError(
        creationError instanceof Error ? creationError.message : 'Não foi possível criar a turma.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTurmaId) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = crypto.randomUUID();
      const payload: Record<string, any> = {
        turma_id: selectedTurmaId,
        created_by: user.id,
        token,
        invite_type: inviteEmail.trim() ? 'email' : inviteType,
        email: inviteEmail.trim() || null,
        expires_at: addDays(new Date(), 14).toISOString(),
      };

      const { data, error } = await supabase.from('turma_invites').insert(payload).select('*').single();
      if (error) throw error;

      const url = `${window.location.origin}/invite/${token}`;
      setInviteUrl(url);
      setCurrentInvite(data as TurmaInvite);
      setInvites((current) => [data as TurmaInvite, ...current]);
      setInviteEmail('');
      setInviteType('link');
    } catch (inviteError) {
      setError(
        inviteError instanceof Error ? inviteError.message : 'Não foi possível gerar o convite.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
  };

  const openTurmaDetail = (turmaId: string) => {
    navigate(`/turma/${turmaId}`);
  };

  useEffect(() => {
    if (!selectedTurmaId && selectedTurmaSummary?.turma.id) {
      setSelectedTurmaId(selectedTurmaSummary.turma.id);
    }
  }, [selectedTurmaId, selectedTurmaSummary]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans flex items-center justify-center">
        <div className="w-full max-w-xl rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-10 text-center">
          <Users className="mx-auto h-16 w-16 text-neutral-800" />
          <h1 className="mt-6 text-4xl font-black italic uppercase tracking-tighter">Acesso restrito</h1>
          <p className="mt-4 text-sm text-neutral-500">
            Apenas treinador ou super admin podem configurar turmas e convites.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl brand-gradient px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">
              Módulo 1
            </p>
            <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter uppercase leading-[0.8]">
              Configuração de Turma
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-bold leading-relaxed text-neutral-500">
              Crie a turma, defina a cadência semanal e gere links ou convites por e-mail para os alunos entrarem.
            </p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#1a1a1a] px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-emerald-500 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao admin
          </button>
        </header>

        {error && (
          <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-5 text-rose-100">
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Atenção</p>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6 md:p-8">
            <div className="flex items-center gap-3">
              <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-2xl">
                <Settings2 className="h-6 w-6 text-black" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Nova turma</p>
                <p className="text-xl font-black uppercase tracking-tighter text-white">
                  Criar programa e turma
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateTurma} className="mt-8 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Programa existente
                </label>
                <select
                  value={selectedProgramId}
                  onChange={(event) => setSelectedProgramId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none focus:border-emerald-500"
                >
                  <option value="">Criar novo programa</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Novo programa
                </label>
                <input
                  value={newProgramName}
                  onChange={(event) => setNewProgramName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                  placeholder="Ex: Eu Vencedor"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Nome da turma
                </label>
                <input
                  value={turmaName}
                  onChange={(event) => setTurmaName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                  placeholder="Turma 01"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Início do ciclo
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Fechamento semanal
                </label>
                <select
                  value={fechamentoDia}
                  onChange={(event) => setFechamentoDia(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none focus:border-emerald-500"
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
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Horário do fechamento
                </label>
                <input
                  type="time"
                  value={fechamentoHora}
                  onChange={(event) => setFechamentoHora(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Semanas do ciclo
                </label>
                <input
                  type="number"
                  min="1"
                  value={weeksCount}
                  onChange={(event) => setWeeksCount(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                  placeholder="12"
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl brand-gradient px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Criar turma
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Turma ativa</p>
              <p className="mt-3 text-xl font-black uppercase tracking-tighter text-white">
                {selectedTurma?.name || 'Nenhuma turma selecionada'}
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                {selectedTurma
                  ? `Fechamento: ${selectedTurma.fechamento_dia} às ${selectedTurma.fechamento_hora}`
                  : 'Crie uma turma para gerar convites.'}
              </p>
            </div>

            <div className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Convite</p>
              <form onSubmit={handleCreateInvite} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                    E-mail do aluno
                  </label>
                  <input
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                    placeholder="opcional"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                    Tipo de convite
                  </label>
                  <select
                    value={inviteType}
                    onChange={(event) => setInviteType(event.target.value as 'link' | 'email')}
                    className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none focus:border-emerald-500"
                  >
                    <option value="link">Link único da turma</option>
                    <option value="email">Convite por e-mail</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={!selectedTurmaId || submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl brand-gradient px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Gerar convite
                </button>
              </form>

              <AnimatePresence>
                {inviteUrl && currentInvite && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-5 rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">
                      Convite criado
                    </p>
                    <p className="mt-2 break-all text-sm text-emerald-50/90">{inviteUrl}</p>
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100 hover:border-emerald-500/40"
                    >
                      <ClipboardCopy className="h-4 w-4" />
                      Copiar link
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>
        </div>

        <section className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                Turmas existentes
              </p>
              <h2 className="mt-2 text-2xl font-black italic uppercase tracking-tighter text-white">
                Clique na turma para ver os membros
              </h2>
            </div>
            <div className="rounded-full border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              {turmaSummaries.length} turma(s)
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-3">
              {turmaSummaries.map((summary) => {
                const isSelected = selectedTurmaSummary?.turma.id === summary.turma.id;

                return (
                  <div
                    key={summary.turma.id}
                    className={`rounded-[24px] border p-4 transition-all ${
                      isSelected
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-[#1a1a1a] bg-[#0a0a0a] hover:border-emerald-500/20 hover:bg-[#0f0f0f]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedTurmaId(summary.turma.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-emerald-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                            {summary.statusLabel}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                            {summary.programName ?? 'Programa sem nome'}
                          </span>
                        </div>
                        <p className="mt-3 text-lg font-black uppercase tracking-tighter text-white">
                          {summary.turma.name}
                        </p>
                        <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
                          {summary.trainerName ?? 'Treinador não identificado'}
                        </p>
                      </button>

                      <div className="flex items-center gap-2">
                        <ChevronRight className={`mt-1 h-5 w-5 ${isSelected ? 'text-emerald-400' : 'text-neutral-700'}`} />
                        <button
                          type="button"
                          onClick={() => openTurmaDetail(summary.turma.id)}
                          className="rounded-full border border-emerald-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-200"
                        >
                          Abrir página
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#1a1a1a] bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                        {summary.memberCount} membro(s)
                      </span>
                      <span className="rounded-full border border-[#1a1a1a] bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                        {summary.activeMemberCount} ativos
                      </span>
                      <span className="rounded-full border border-[#1a1a1a] bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                        {summary.ongoingCycleCount} ciclo(s) ativos
                      </span>
                    </div>
                  </div>
                );
              })}

              {turmaSummaries.length === 0 && (
                <div className="rounded-[24px] border border-dashed border-[#1a1a1a] bg-[#0a0a0a] p-6 text-sm text-neutral-500">
                  Nenhuma turma cadastrada ainda. Crie a primeira turma no bloco acima.
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] p-5 md:p-6">
              {selectedTurmaSummary ? (
                <div className="space-y-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                        Turma selecionada
                      </p>
                      <h3 className="mt-2 text-3xl font-black italic uppercase tracking-tighter text-white">
                        {selectedTurmaSummary.turma.name}
                      </h3>
                      <p className="mt-2 text-sm text-neutral-500">
                        {selectedTurmaSummary.programName ?? 'Sem programa vinculado'} ·{' '}
                        {selectedTurmaSummary.trainerName ?? 'Treinador não identificado'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-3 text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Fechamento
                      </p>
                      <p className="mt-1 text-sm font-bold text-white">
                        Dia {selectedTurmaSummary.turma.fechamento_dia} · {selectedTurmaSummary.turma.fechamento_hora}
                      </p>
                      <button
                        type="button"
                        onClick={() => openTurmaDetail(selectedTurmaSummary.turma.id)}
                        className="mt-3 inline-flex items-center justify-center rounded-xl border border-emerald-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-200"
                      >
                        Abrir página dedicada
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Membros
                      </p>
                      <p className="mt-2 text-3xl font-black italic text-white">
                        {selectedTurmaMembers.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Ativos
                      </p>
                      <p className="mt-2 text-3xl font-black italic text-white">
                        {selectedTurmaSummary.activeMemberCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Ciclos
                      </p>
                      <p className="mt-2 text-3xl font-black italic text-white">
                        {selectedTurmaSummary.ongoingCycleCount + selectedTurmaSummary.concludedCycleCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#1a1a1a] bg-[#050505] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Início
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">
                        {format(new Date(selectedTurmaSummary.turma.start_date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#1a1a1a] bg-[#050505] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                          Membros da turma
                        </p>
                        <h4 className="mt-1 text-xl font-black uppercase tracking-tighter text-white">
                          {selectedTurmaMembers.length > 0
                            ? 'Participantes vinculados'
                            : 'Nenhum membro vinculado'}
                        </h4>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {selectedTurmaSummary.statusLabel}
                      </div>
                    </div>

                    <div className="mt-4 divide-y divide-[#1a1a1a] overflow-hidden rounded-[20px] border border-[#1a1a1a]">
                      {selectedTurmaMembers.map((member) => (
                        <div
                          key={member.enrollment.id}
                          className="flex flex-col gap-3 bg-[#0a0a0a] p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="text-sm font-black uppercase tracking-tighter text-white">
                              {member.profile?.full_name ?? 'Usuário sem perfil'}
                            </p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
                              {member.profile?.email ?? 'E-mail indisponível'}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                              {member.enrollment.status ?? 'sem status'}
                            </span>
                            <span className="rounded-full border border-[#1a1a1a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                              {member.cycle ? `Ciclo ${member.cycle.number}` : 'Sem ciclo'}
                            </span>
                            <span className="rounded-full border border-[#1a1a1a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                              {member.cycle?.status ?? 'sem ciclo ativo'}
                            </span>
                          </div>
                        </div>
                      ))}

                      {selectedTurmaMembers.length === 0 && (
                        <div className="bg-[#0a0a0a] p-6 text-sm text-neutral-500">
                          Nenhum membro vinculado a esta turma ainda.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[240px] items-center justify-center rounded-[24px] border border-dashed border-[#1a1a1a] bg-[#050505] p-8 text-center">
                  <div>
                    <Users className="mx-auto h-12 w-12 text-neutral-800" />
                    <p className="mt-4 text-xl font-black uppercase tracking-tighter text-white">
                      Selecione uma turma
                    </p>
                    <p className="mt-2 text-sm text-neutral-500">
                      Os membros aparecem aqui assim que uma turma estiver disponível.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Convites recentes</p>
              <h2 className="mt-2 text-2xl font-black italic uppercase tracking-tighter text-white">
                Histórico da turma
              </h2>
            </div>
            <div className="rounded-full border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              {invites.length} convite(s)
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[28px] border border-[#1a1a1a]">
            <table className="w-full text-left">
              <thead className="bg-[#0a0a0a]">
                <tr>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Turma</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Token</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Tipo</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Status</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {invites.map((invite) => (
                  <tr key={invite.id} className="bg-[#050505]">
                    <td className="p-4">
                      <p className="text-sm font-black uppercase tracking-tighter text-white">
                        {selectedTurmaInviteLabel}
                      </p>
                    </td>
                    <td className="p-4 text-sm font-mono text-neutral-300">{invite.token.slice(0, 8)}...</td>
                    <td className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                      {invite.invite_type}
                    </td>
                    <td className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                      {invite.status}
                    </td>
                    <td className="p-4 text-sm text-neutral-400">
                      {format(new Date(invite.created_at), 'dd/MM/yyyy HH:mm')}
                    </td>
                  </tr>
                ))}
                {invites.length === 0 && (
                  <tr>
                    <td className="p-6 text-sm text-neutral-500" colSpan={5}>
                      Nenhum convite gerado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
