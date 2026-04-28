import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  Target,
  Database,
  Flame,
  Settings2,
  Users,
  CalendarRange,
  BadgeCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { differenceInDays, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Program, Cycle } from '../types';

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

type StepId = 'perfil' | 'programa' | 'roi' | 'plano' | 'habitos' | 'final';

const STEPS: Array<{ id: StepId; label: string; hint: string }> = [
  { id: 'perfil', label: 'Perfil', hint: 'Confirme seu nome e contexto de acesso.' },
  { id: 'programa', label: 'Programa', hint: 'Escolha ou crie o programa vinculado ao seu ciclo.' },
  { id: 'roi', label: 'ROI', hint: 'Registre sua base financeira e meta inicial.' },
  { id: 'plano', label: 'Plano 12WY', hint: 'Crie o primeiro objetivo, tática e tarefa.' },
  { id: 'habitos', label: 'Hábitos', hint: 'Inclua pelo menos um hábito para começar.' },
  { id: 'final', label: 'Concluir', hint: 'Revise tudo e marque o onboarding como completo.' },
];

function parseSpecificDays(raw: string) {
  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function toggleWeekdaySelection(selectedDays: number[], weekday: number) {
  if (selectedDays.includes(weekday)) {
    return selectedDays.filter((day) => day !== weekday);
  }

  return [...selectedDays, weekday].sort((left, right) => left - right);
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [profileName, setProfileName] = useState(profile?.full_name ?? '');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [newProgramName, setNewProgramName] = useState('');
  const [baselineIncome, setBaselineIncome] = useState('');
  const [investment, setInvestment] = useState('0');
  const [goalIncome, setGoalIncome] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalIndicator, setGoalIndicator] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [tacticTitle, setTacticTitle] = useState('');
  const [tacticDescription, setTacticDescription] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskFrequency, setTaskFrequency] = useState<'daily' | 'specific_days' | 'weekly'>('daily');
  const [taskSpecificDays, setTaskSpecificDays] = useState('');
  const [habitName, setHabitName] = useState('');
  const [habitType, setHabitType] = useState<'build' | 'abandon'>('build');
  const [habitFrequency, setHabitFrequency] = useState<'daily' | 'specific_days' | 'weekly'>('daily');
  const [habitSpecificDays, setHabitSpecificDays] = useState<number[]>([1, 3, 5]);
  const [habitTargetDays, setHabitTargetDays] = useState('7');
  const [habitReminderEnabled, setHabitReminderEnabled] = useState(false);
  const [habitReminderTime, setHabitReminderTime] = useState('08:00');
  const [savedProgramName, setSavedProgramName] = useState<string | null>(null);

  const firstWeek = useMemo(() => {
    if (!profile?.created_at) return false;
    return differenceInDays(new Date(), new Date(profile.created_at)) < 7;
  }, [profile?.created_at]);

  const currentStep = STEPS[stepIndex];

  useEffect(() => {
    if (profile?.full_name) {
      setProfileName(profile.full_name);
    }
  }, [profile?.full_name]);

  useEffect(() => {
    setHabitReminderEnabled(Boolean(profile?.habit_reminder_enabled));
    setHabitReminderTime(profile?.habit_reminder_time ?? '08:00');
  }, [profile?.habit_reminder_enabled, profile?.habit_reminder_time]);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [programsResult, cycleResult, enrollmentResult, baselineResult] = await Promise.all([
        supabase.from('programs').select('*').order('created_at', { ascending: true }),
        supabase.from('cycles').select('*').eq('aluno_id', user.id).eq('status', 'active').maybeSingle(),
        supabase
          .from('enrollments')
          .select('*, turmas(*)')
          .eq('aluno_id', user.id)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('roi_baselines')
          .select('*')
          .eq('aluno_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!mounted) return;

      if (programsResult.error) {
        setError('Não foi possível carregar a lista de programas.');
      } else {
        setPrograms((programsResult.data ?? []) as Program[]);
      }

      if (cycleResult.error) {
        setError('Não foi possível carregar o ciclo ativo.');
      } else {
        setActiveCycle((cycleResult.data ?? null) as Cycle | null);
      }

      const activeEnrollment = enrollmentResult.data as any;
      const turmaProgramId = activeEnrollment?.turmas?.program_id ?? null;
      if (turmaProgramId) {
        setSelectedProgramId(String(turmaProgramId));
      }

      if (baselineResult.data) {
        const baseline = baselineResult.data as any;
        setBaselineIncome(String(baseline.baseline_income ?? baseline.initial_revenue ?? ''));
        setInvestment(String(baseline.investment ?? '0'));
        setGoalIncome(String(baseline.goal_income ?? baseline.target_revenue ?? ''));
        if (baseline.program_id) {
          setSelectedProgramId(String(baseline.program_id));
        }
      }

      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user]);

  const activeProgramName = useMemo(() => {
    if (selectedProgramId) {
      return programs.find((program) => program.id === selectedProgramId)?.name ?? null;
    }
    return savedProgramName;
  }, [programs, selectedProgramId, savedProgramName]);

  const handleNext = () => setStepIndex((value) => Math.min(value + 1, STEPS.length - 1));
  const handleBack = () => setStepIndex((value) => Math.max(value - 1, 0));

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
    setSavedProgramName(data.name);
    return data.id;
  };

  const ensureCycle = async () => {
    if (activeCycle) return activeCycle.id;

    const [{ data: latestCycle }, { data: activeEnrollment, error: enrollmentError }] = await Promise.all([
      supabase
        .from('cycles')
        .select('number')
        .eq('aluno_id', user?.id)
        .order('number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('enrollments')
        .select('turma_id')
        .eq('aluno_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (enrollmentError) {
      console.warn('Onboarding enrollment lookup failed:', enrollmentError);
    }

    const payload: Record<string, any> = {
      aluno_id: user?.id,
      number: Number((latestCycle as any)?.number ?? 0) + 1,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      status: 'active',
    };

    const turmaId = (activeEnrollment as any)?.turma_id ?? null;
    if (turmaId) {
      payload.turma_id = turmaId;
    }

    const { data, error } = await supabase.from('cycles').insert(payload).select('*').single();
    if (error) throw error;

    setActiveCycle(data as Cycle);
    return data.id;
  };

  const handleFinish = async () => {
    if (!user || !profile) return;

    const trimmedName = profileName.trim();
    const chosenGoalTitle = goalTitle.trim();
    const chosenHabitName = habitName.trim();

    if (!trimmedName) {
      setError('Informe seu nome para concluir o onboarding.');
      return;
    }

    if (!chosenGoalTitle) {
      setError('Crie ao menos um objetivo para concluir o onboarding.');
      return;
    }

    if (!chosenHabitName) {
      setError('Crie ao menos um hábito para concluir o onboarding.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const programId = await ensureProgram();
      const cycleId = await ensureCycle();

      const { data: existingBaseline } = await supabase
        .from('roi_baselines')
        .select('id')
        .eq('aluno_id', user.id)
        .eq('program_id', programId)
        .eq('cycle_id', cycleId)
        .maybeSingle();

      const baselinePayload = {
        aluno_id: user.id,
        program_id: programId,
        cycle_id: cycleId,
        baseline_income: Number(baselineIncome || 0),
        investment: Number(investment || 0),
        goal_income: goalIncome.trim() ? Number(goalIncome) : null,
        goal_status: goalIncome.trim() ? 'proposed' : 'draft',
        goal_note: goalIncome.trim() ? 'Meta inicial definida no onboarding.' : null,
        goal_proposed_by: goalIncome.trim() ? user.id : null,
        goal_proposed_at: goalIncome.trim() ? new Date().toISOString() : null,
        goal_approved_by: null,
        goal_approved_at: null,
      };

      if (existingBaseline?.id) {
        const { error } = await supabase.from('roi_baselines').update(baselinePayload).eq('id', existingBaseline.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('roi_baselines').insert(baselinePayload);
        if (error) throw error;
      }

      const { data: goal, error: goalError } = await supabase
        .from('goals')
        .insert({
          cycle_id: cycleId,
          title: chosenGoalTitle,
          description: goalDescription.trim() || null,
          indicator: goalIndicator.trim() || null,
          deadline: goalDeadline || null,
          order: 0,
        })
        .select('*')
        .single();
      if (goalError) throw goalError;

      const { data: tactic, error: tacticError } = await supabase
        .from('tactics')
        .insert({
          goal_id: goal.id,
          title: tacticTitle.trim() || 'Tática inicial',
          description: tacticDescription.trim() || null,
          order: 0,
        })
        .select('*')
        .single();
      if (tacticError) throw tacticError;

      const { error: taskError } = await supabase.from('tasks').insert({
        tactic_id: tactic.id,
        title: taskTitle.trim() || 'Primeira tarefa',
        frequency: taskFrequency,
        specific_days: taskFrequency === 'specific_days' ? parseSpecificDays(taskSpecificDays) : null,
      });
      if (taskError) throw taskError;

      const { error: habitError } = await supabase.from('habits').insert({
        aluno_id: user.id,
        name: chosenHabitName,
        type: habitType,
        frequency: habitFrequency,
        specific_days: habitFrequency === 'specific_days' ? habitSpecificDays : [],
        target_days: Number(habitTargetDays || 7),
        is_paused: false,
        streak_reset_on: null,
      });
      if (habitError) throw habitError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: trimmedName,
          onboarding_completed_at: new Date().toISOString(),
          habit_reminder_enabled: habitReminderEnabled,
          habit_reminder_time: habitReminderEnabled ? habitReminderTime : null,
        })
        .eq('id', user.id);
      if (profileError) throw profileError;

      await refreshProfile();
      navigate('/plano', { replace: true });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Não foi possível concluir o onboarding. Tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col gap-6 rounded-[36px] border border-[#1a1a1a] bg-[#050505] p-6 md:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 h-80 w-80 brand-gradient blur-[160px] opacity-10" />

        <header className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">
              Primeiro acesso
            </p>
            <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter uppercase leading-[0.8]">
              Onboarding Guiado
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-bold leading-relaxed text-neutral-500">
              Siga os passos para configurar seu acesso, registrar sua base financeira e criar o primeiro bloco do Plano 12WY.
            </p>
          </div>

          <div className="rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] px-6 py-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Aluno</p>
            <p className="mt-2 text-sm font-black uppercase tracking-tight text-white">
              {profile?.full_name || user?.email || 'Sem nome'}
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
              {profile?.email || user?.email}
            </p>
          </div>
        </header>

        <div className="relative z-10 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[32px] border border-[#1a1a1a] bg-[#0a0a0a] p-6">
            <div className="flex items-center gap-3">
              <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-2xl">
                <Sparkles className="h-6 w-6 text-black" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Etapa atual</p>
                <p className="text-lg font-black uppercase tracking-tighter text-white">
                  {currentStep.label}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              {STEPS.map((step, index) => {
                const isActive = index === stepIndex;
                const isDone = index < stepIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setStepIndex(index)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                      isActive
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : isDone
                          ? 'border-[#1a1a1a] bg-[#070707]'
                          : 'border-[#1a1a1a] bg-[#050505] hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                          {String(index + 1).padStart(2, '0')}
                        </p>
                        <p className="mt-1 text-xs font-black uppercase tracking-widest text-white">
                          {step.label}
                        </p>
                      </div>
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-emerald-400' : 'text-neutral-600'}`}>
                          {isActive ? 'ativo' : 'pendente'}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-[10px] font-bold uppercase leading-relaxed tracking-widest text-neutral-500">
                      {step.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            {firstWeek && (
              <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">
                  Primeira semana
                </p>
                <p className="mt-2 text-sm text-emerald-50/90">
                  Os tooltips desse fluxo foram pensados para a primeira semana de uso, quando a curva de aprendizado é maior.
                </p>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-[#1a1a1a] bg-[#050505] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                Contexto detectado
              </p>
              <div className="mt-3 space-y-3 text-sm text-neutral-300">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <span>{activeCycle ? `Ciclo ativo #${activeCycle.number}` : 'Nenhum ciclo ativo'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-400" />
                  <span>{activeProgramName ? `Programa: ${activeProgramName}` : 'Programa ainda não escolhido'}</span>
                </div>
              </div>
            </div>
          </aside>

          <main className="rounded-[32px] border border-[#1a1a1a] bg-[#0a0a0a] p-6 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-8"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                      Passo {stepIndex + 1} de {STEPS.length}
                    </p>
                    <h2 className="mt-2 text-3xl md:text-4xl font-black italic uppercase tracking-tighter">
                      {currentStep.label}
                    </h2>
                  </div>
                  <div className="w-full md:w-80">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                      <span>Progresso</span>
                      <span>{Math.round(((stepIndex + 1) / STEPS.length) * 100)}%</span>
                    </div>
                    <div className="h-3 rounded-full border border-[#1a1a1a] bg-[#050505] p-1">
                      <div
                        className="h-full rounded-full brand-gradient transition-all"
                        style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Tooltip guiado</p>
                  <p className="mt-2 text-sm text-emerald-50/90">
                    {currentStep.hint}
                  </p>
                </div>

                {error && (
                  <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-5 text-rose-100">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Atenção</p>
                    <p className="mt-2 text-sm">{error}</p>
                  </div>
                )}

                {stepIndex === 0 && (
                  <section className="grid gap-5 md:grid-cols-2">
                    <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Perfil</p>
                      <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Nome completo
                      </label>
                      <input
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                        placeholder="Seu nome"
                      />
                    </div>
                    <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Identidade</p>
                      <div className="mt-4 space-y-3 text-sm text-neutral-300">
                        <div className="flex items-center gap-2">
                          <BadgeCheck className="h-4 w-4 text-emerald-400" />
                          <span>{profile?.email || user?.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-emerald-400" />
                          <span>O onboarding vai criar o primeiro objetivo, tática, tarefa e hábito</span>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {stepIndex === 1 && (
                  <section className="grid gap-5 md:grid-cols-2">
                    <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Programa</p>
                      <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Selecionar programa existente
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
                      <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        Novo programa
                      </label>
                      <input
                        value={newProgramName}
                        onChange={(event) => setNewProgramName(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                        placeholder="Ex: Rota do Êxito"
                      />
                    </div>
                    <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Vínculo</p>
                      <div className="mt-4 space-y-3 text-sm text-neutral-300">
                        <div className="flex items-center gap-2">
                          <CalendarRange className="h-4 w-4 text-emerald-400" />
                          <span>
                            {activeCycle ? 'Este aluno já tem ciclo ativo' : 'Um ciclo será criado ao concluir'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-emerald-400" />
                          <span>
                            {selectedProgramId || newProgramName
                              ? 'O programa escolhido será usado na base de ROI'
                              : 'Escolha um programa para continuar'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {stepIndex === 2 && (
                  <section className="grid gap-5 md:grid-cols-3">
                    <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5 md:col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Baseline financeiro</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                            Faturamento base
                          </label>
                          <input
                            type="number"
                            value={baselineIncome}
                            onChange={(event) => setBaselineIncome(event.target.value)}
                            className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                            Investimento
                          </label>
                          <input
                            type="number"
                            value={investment}
                            onChange={(event) => setInvestment(event.target.value)}
                            className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                            Meta de ROI
                          </label>
                          <input
                            type="number"
                            value={goalIncome}
                            onChange={(event) => setGoalIncome(event.target.value)}
                            className="mt-2 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                            placeholder="Opcional"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Tooltip</p>
                      <div className="mt-4 flex items-start gap-3 text-sm text-neutral-300">
                        <Database className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <p>
                          O baseline é o ponto de partida para medir o retorno real do treinamento ao longo do ciclo.
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {stepIndex === 3 && (
                  <section className="space-y-5">
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                          Objetivo SMART
                        </p>
                        <input
                          value={goalTitle}
                          onChange={(event) => setGoalTitle(event.target.value)}
                          className="mt-4 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                          placeholder="Título do objetivo"
                        />
                        <textarea
                          value={goalDescription}
                          onChange={(event) => setGoalDescription(event.target.value)}
                          className="mt-4 min-h-[120px] w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                          placeholder="Descrição do objetivo"
                        />
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <input
                            value={goalIndicator}
                            onChange={(event) => setGoalIndicator(event.target.value)}
                            className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                            placeholder="Indicador"
                          />
                          <input
                            type="date"
                            value={goalDeadline}
                            onChange={(event) => setGoalDeadline(event.target.value)}
                            className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Tática e tarefa</p>
                        <input
                          value={tacticTitle}
                          onChange={(event) => setTacticTitle(event.target.value)}
                          className="mt-4 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                          placeholder="Título da tática"
                        />
                        <textarea
                          value={tacticDescription}
                          onChange={(event) => setTacticDescription(event.target.value)}
                          className="mt-4 min-h-[110px] w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                          placeholder="Descrição da tática"
                        />
                        <input
                          value={taskTitle}
                          onChange={(event) => setTaskTitle(event.target.value)}
                          className="mt-4 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                          placeholder="Título da tarefa"
                        />
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <select
                            value={taskFrequency}
                            onChange={(event) => setTaskFrequency(event.target.value as 'daily' | 'specific_days' | 'weekly')}
                            className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none focus:border-emerald-500"
                          >
                            <option value="daily">Diária</option>
                            <option value="specific_days">Dias específicos</option>
                            <option value="weekly">Semanal</option>
                          </select>
                          <input
                            value={taskSpecificDays}
                            onChange={(event) => setTaskSpecificDays(event.target.value)}
                            className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                            placeholder="Ex: 1,3,5"
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {stepIndex === 4 && (
                  <section className="grid gap-5 md:grid-cols-2">
                    <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Hábito inicial</p>
                      <input
                        value={habitName}
                        onChange={(event) => setHabitName(event.target.value)}
                        className="mt-4 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                        placeholder="Nome do hábito"
                      />
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <select
                          value={habitType}
                          onChange={(event) => setHabitType(event.target.value as 'build' | 'abandon')}
                          className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none focus:border-emerald-500"
                        >
                          <option value="build">Construir</option>
                          <option value="abandon">Abandonar</option>
                        </select>
                        <select
                          value={habitFrequency}
                          onChange={(event) => setHabitFrequency(event.target.value as 'daily' | 'specific_days' | 'weekly')}
                          className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none focus:border-emerald-500"
                        >
                          <option value="daily">Diária</option>
                          <option value="specific_days">Dias específicos</option>
                          <option value="weekly">Semanal</option>
                        </select>
                        <input
                          type="number"
                          value={habitTargetDays}
                          onChange={(event) => setHabitTargetDays(event.target.value)}
                          className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-mono outline-none placeholder:text-neutral-800 focus:border-emerald-500"
                          placeholder="Meta de dias"
                        />
                      </div>
                      <div className="mt-4 rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Dias específicos</p>
                        <div className="mt-3 grid grid-cols-7 gap-2">
                          {WEEKDAY_OPTIONS.map((weekday) => {
                            const active = habitSpecificDays.includes(weekday.value);
                            return (
                              <button
                                key={weekday.value}
                                type="button"
                                onClick={() => setHabitSpecificDays((current) => toggleWeekdaySelection(current, weekday.value))}
                                className={`rounded-xl border px-0 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                                  active
                                    ? 'brand-gradient border-transparent text-black'
                                    : 'border-[#1f1f1f] text-neutral-500 hover:border-emerald-500/40 hover:text-white'
                                }`}
                              >
                                {weekday.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-3 text-[10px] text-neutral-600 uppercase tracking-[0.2em]">
                          Use só quando a frequência for dias específicos.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Preparação</p>
                      <div className="mt-4 space-y-3 text-sm text-neutral-300">
                        <div className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-emerald-400" />
                          <span>O hábito já nasce pronto para check-in simples no app.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4 text-emerald-400" />
                          <span>Depois você pode ajustar frequência, meta, pausa e lembrete diário.</span>
                        </div>
                      </div>
                      <div className="mt-6 rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Lembrete diário</p>
                            <p className="mt-2 text-xs text-neutral-400">
                              Você escolhe o horário. O app pode avisar via PWA quando a permissão estiver ativa.
                            </p>
                          </div>
                          <label className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                            <input
                              type="checkbox"
                              checked={habitReminderEnabled}
                              onChange={(event) => setHabitReminderEnabled(event.target.checked)}
                              className="h-4 w-4 rounded border-[#1f1f1f] bg-[#050505] text-emerald-500 focus:ring-emerald-500"
                            />
                            Ativo
                          </label>
                        </div>
                        <input
                          type="time"
                          value={habitReminderTime}
                          onChange={(event) => setHabitReminderTime(event.target.value)}
                          className="mt-4 w-full rounded-2xl border border-[#1a1a1a] bg-[#050505] px-4 py-4 text-sm font-mono outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </section>
                )}

                {stepIndex === 5 && (
                  <section className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Resumo final</p>
                      <div className="mt-4 grid gap-3 text-sm text-neutral-300">
                        <div>Nome: {profileName || 'não informado'}</div>
                        <div>Programa: {activeProgramName || newProgramName || 'novo programa'}</div>
                        <div>Baseline: {baselineIncome || '0'} / Investimento: {investment || '0'}</div>
                        <div>Objetivo: {goalTitle || 'não informado'}</div>
                        <div>Hábito: {habitName || 'não informado'}</div>
                        <div>
                          Lembrete: {habitReminderEnabled ? `ativo às ${habitReminderTime}` : 'desativado'}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Concluir</p>
                      <p className="mt-4 text-sm text-neutral-300 leading-relaxed">
                        Ao finalizar, o app salva sua base, cria o primeiro bloco do Plano 12WY e marca seu onboarding como concluído.
                      </p>
                    </div>
                  </section>
                )}

                <div className="flex flex-col gap-4 border-t border-[#1a1a1a] pt-6 md:flex-row md:items-center md:justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={stepIndex === 0 || submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#1a1a1a] px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-emerald-500 hover:text-white disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>

                  {stepIndex < STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl brand-gradient px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98]"
                    >
                      Avançar
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFinish}
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl brand-gradient px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98] disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Concluir onboarding
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
