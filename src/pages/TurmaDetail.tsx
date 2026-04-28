import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Download, Loader2, Mail, UserRound, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateTurmaPDF } from '../lib/pdfExport';
import type { Cycle, Enrollment, Profile, Program, Turma, TurmaInvite, AdminTurmaMember } from '../types';
import { formatTurmaInviteLabel } from '../lib/turmaLabel';

export default function TurmaDetail() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId: string }>();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [turma, setTurma] = useState<Turma | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [trainersById, setTrainersById] = useState<Record<string, Profile>>({});
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [invites, setInvites] = useState<TurmaInvite[]>([]);
  const [turmaNumber, setTurmaNumber] = useState<number | null>(null);
  const [weeklyScores, setWeeklyScores] = useState<any[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);

  const canManage = profile?.role === 'TREINADOR' || profile?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!user || !turmaId) return;

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [turmaRes, programRes, profilesRes, enrollmentsRes, cyclesRes, invitesRes] = await Promise.all([
        supabase.from('turmas').select('*').eq('id', turmaId).maybeSingle(),
        supabase.from('programs').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('enrollments').select('*').eq('turma_id', turmaId).order('created_at', { ascending: false }),
        supabase.from('cycles').select('*').eq('turma_id', turmaId).order('created_at', { ascending: false }),
        supabase.from('turma_invites').select('*').eq('turma_id', turmaId).order('created_at', { ascending: false }),
      ]);

      if (!mounted) return;

      const queryError = turmaRes.error || programRes.error || profilesRes.error || enrollmentsRes.error || cyclesRes.error || invitesRes.error;
      if (queryError) {
        setError('Não foi possível carregar os detalhes desta turma.');
        setLoading(false);
        return;
      }

      const turmaRow = turmaRes.data as Turma | null;
      if (!turmaRow) {
        setError('Turma não encontrada.');
        setLoading(false);
        return;
      }

      if (profile?.role !== 'SUPER_ADMIN' && turmaRow.treinador_id !== user.id) {
        setError('Você não tem acesso a esta turma.');
        setLoading(false);
        return;
      }

      setTurma(turmaRow);
      setProgram(((programRes.data ?? []) as Program[]).find((row) => row.id === turmaRow.program_id) ?? null);

      if (turmaRow.program_id) {
        const { data: sameProgramTurmas } = await supabase
          .from('turmas')
          .select('id, created_at')
          .eq('program_id', turmaRow.program_id)
          .order('created_at', { ascending: true });

        if (!mounted) return;

        const turmaPosition = (sameProgramTurmas ?? []).findIndex((row) => row.id === turmaRow.id);
        setTurmaNumber(turmaPosition >= 0 ? turmaPosition + 1 : null);
      } else {
        setTurmaNumber(null);
      }

      const profiles = (profilesRes.data ?? []) as Profile[];
      setProfilesById(
        profiles.reduce<Record<string, Profile>>((acc, current) => {
          acc[current.id] = current;
          return acc;
        }, {})
      );
      setTrainersById(
        profiles.reduce<Record<string, Profile>>((acc, current) => {
          if (current.id === turmaRow.treinador_id) {
            acc[current.id] = current;
          }
          return acc;
        }, {})
      );
      setEnrollments((enrollmentsRes.data ?? []) as Enrollment[]);
      const cyclesData = (cyclesRes.data ?? []) as Cycle[];
      setCycles(cyclesData);
      setInvites((invitesRes.data ?? []) as TurmaInvite[]);

      // Buscar weekly_scores após ter os cycles
      if (cyclesData.length > 0 && mounted) {
        const cycleIds = cyclesData.map(c => c.id);
        const { data: weeklyScoresData } = await supabase
          .from('weekly_scores')
          .select('*')
          .in('cycle_id', cycleIds);
        if (weeklyScoresData && mounted) {
          setWeeklyScores(weeklyScoresData);
        }
      }

      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user, profile?.role, turmaId]);

  const members = useMemo<AdminTurmaMember[]>(() => {
    return enrollments.map((enrollment) => {
      const cyclesForStudent = cycles
        .filter((cycle) => cycle.aluno_id === enrollment.aluno_id)
        .slice()
        .sort((left, right) => right.created_at.localeCompare(left.created_at));

      return {
        enrollment,
        profile: enrollment.aluno_id ? profilesById[enrollment.aluno_id] ?? null : null,
        cycle: cyclesForStudent[0] ?? null,
      };
    });
  }, [enrollments, cycles, profilesById]);

  const activeMembers = members.filter((member) => member.enrollment.status === 'active').length;
  const concludedMembers = members.filter((member) => member.enrollment.status === 'concluded').length;
  const activeCycles = cycles.filter((cycle) => cycle.status === 'active').length;
  const archivedCycles = cycles.filter((cycle) => cycle.status === 'archived').length;
  const turmaDisplayLabel = turma
    ? formatTurmaInviteLabel(turma.name, {
        programName: program?.name ?? null,
        turmaNumber,
        mode: 'standard',
      })
    : null;

  const handleExportTurmaPDF = async () => {
    if (!turma || !program) {
      setPdfMessage('Dados da turma incompletos.');
      return;
    }

    setPdfLoading(true);
    setPdfMessage(null);

    try {
      // Calcular métricas da turma
      const membersWithScores = members.map(member => {
        const memberScores = weeklyScores.filter(ws => ws.aluno_id === member.enrollment.aluno_id);
        const avgScore = memberScores.length > 0
          ? Math.round(memberScores.reduce((sum, ws) => sum + (ws.score ?? 0), 0) / memberScores.length)
          : 0;
        return {
          ...member,
          avgScore,
        };
      });

      const avgScore = membersWithScores.length > 0
        ? Math.round(membersWithScores.reduce((sum, m) => sum + m.avgScore, 0) / membersWithScores.length)
        : 0;

      const atRiskMembers = membersWithScores.filter(m => m.avgScore < 60).length;
      const onTrackMembers = membersWithScores.filter(m => m.avgScore >= 80).length;

      await generateTurmaPDF({
        turma,
        program,
        trainer: trainersById[turma.treinador_id ?? ''] ?? null,
        members: membersWithScores,
        turmaMetrics: {
          avgScore,
          activeMembers,
          atRiskMembers,
          onTrackMembers,
          avgStreak: 0,
        },
      });

      setPdfMessage('PDF da turma gerado com sucesso!');
      setTimeout(() => setPdfMessage(null), 3000);
    } catch (error) {
      console.error('Erro ao gerar PDF da turma:', error);
      setPdfMessage(error instanceof Error ? error.message : 'Não foi possível gerar o PDF da turma.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white flex items-center justify-center">
        <div className="w-full max-w-xl rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-10 text-center">
          <Users className="mx-auto h-16 w-16 text-neutral-800" />
          <h1 className="mt-6 text-4xl font-black italic uppercase tracking-tighter">Acesso restrito</h1>
          <p className="mt-4 text-sm text-neutral-500">
            Apenas treinador ou super admin podem abrir os detalhes da turma.
          </p>
          <button
            onClick={() => navigate('/turma/setup')}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl brand-gradient px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (error || !turma) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white flex items-center justify-center">
        <div className="w-full max-w-xl rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-10 text-center">
          <Users className="mx-auto h-16 w-16 text-neutral-800" />
          <h1 className="mt-6 text-4xl font-black italic uppercase tracking-tighter">Turma indisponível</h1>
          <p className="mt-4 text-sm text-neutral-500">{error ?? 'Não foi possível localizar esta turma.'}</p>
          <button
            onClick={() => navigate('/turma/setup')}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl brand-gradient px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
      <div className="mx-auto max-w-6xl space-y-8">
        {pdfMessage && (
          <div className="rounded-2xl border border-brand-green/20 bg-brand-green/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green">
            {pdfMessage}
          </div>
        )}
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">
              Turma
            </p>
            <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter uppercase leading-[0.8]">
              {turma.name}
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-bold leading-relaxed text-neutral-500">
              {program?.name ?? 'Programa sem nome'} · {trainersById[turma.treinador_id ?? '']?.full_name ?? 'Treinador não identificado'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/turma/setup')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#1a1a1a] px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-emerald-500 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao setup
            </button>
            <button
              onClick={handleExportTurmaPDF}
              disabled={pdfLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl brand-gradient px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pdfLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Exportar Turma PDF
                </>
              )}
            </button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Membros</p>
            <p className="mt-3 text-4xl font-black italic text-white">{members.length}</p>
          </div>
          <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Ativos</p>
            <p className="mt-3 text-4xl font-black italic text-white">{activeMembers}</p>
          </div>
          <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Ciclos</p>
            <p className="mt-3 text-4xl font-black italic text-white">{activeCycles + archivedCycles}</p>
          </div>
          <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Fechamento</p>
            <p className="mt-3 text-sm font-bold text-white">
              Dia {turma.fechamento_dia} · {turma.fechamento_hora}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Início em {format(new Date(turma.start_date), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Membros da turma
                </p>
                <h2 className="mt-2 text-2xl font-black italic uppercase tracking-tighter text-white">
                  Participantes vinculados
                </h2>
              </div>
              <div className="rounded-full border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                {members.length} membro(s)
              </div>
            </div>

            <div className="mt-6 divide-y divide-[#1a1a1a] overflow-hidden rounded-[24px] border border-[#1a1a1a]">
              {members.map((member) => (
                <div
                  key={member.enrollment.id}
                  className="flex flex-col gap-4 bg-[#0a0a0a] p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#1a1a1a] bg-black/30 text-xs font-black uppercase tracking-[0.2em] text-neutral-300">
                      {member.profile?.full_name?.charAt(0) ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tighter text-white">
                        {member.profile?.full_name ?? 'Usuário sem perfil'}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
                        <Mail className="h-3.5 w-3.5" />
                        {member.profile?.email ?? 'E-mail indisponível'}
                      </p>
                    </div>
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

              {members.length === 0 && (
                <div className="bg-[#0a0a0a] p-6 text-sm text-neutral-500">
                  Nenhum membro vinculado a esta turma ainda.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Resumo</p>
              <div className="mt-4 space-y-3 text-sm text-neutral-400">
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2">
                    <UserRound className="h-4 w-4" />
                    Ativos
                  </span>
                  <strong className="text-white">{activeMembers}</strong>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Ciclos ativos
                  </span>
                  <strong className="text-white">{activeCycles}</strong>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Ciclos arquivados
                  </span>
                  <strong className="text-white">{archivedCycles}</strong>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Convites</p>
              <div className="mt-4 space-y-3">
                {invites.map((invite) => (
                  <div key={invite.id} className="rounded-[20px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                    <p className="text-sm font-black uppercase tracking-tighter text-white">
                      {turmaDisplayLabel ?? invite.invite_type}
                    </p>
                    <p className="mt-2 text-xs text-neutral-500">{invite.invite_type}</p>
                    <p className="mt-1 text-xs text-neutral-500">{invite.status}</p>
                    <p className="mt-2 text-[10px] font-mono text-neutral-600">
                      {invite.token.slice(0, 10)}...
                    </p>
                  </div>
                ))}

                {invites.length === 0 && (
                  <p className="text-sm text-neutral-500">Nenhum convite criado para esta turma.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
