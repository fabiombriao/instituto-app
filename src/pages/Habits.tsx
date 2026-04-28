import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Flame,
  Loader2,
  Pause,
  Play,
  Plus,
  Settings2,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useHabits, calculateHabitStreak, buildHabitConsistency, buildHabitHeatmap, isHabitDueOnDate } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const ACTION_TIMEOUT_MS = 8000;

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

function withTimeout(promise: any, label: string, timeoutMs = ACTION_TIMEOUT_MS): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} demorou demais para concluir. Tente novamente.`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function parseError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: string }).message || fallback);
  }
  return fallback;
}

function formatHabitType(type: string | null | undefined) {
  return type === 'abandon' ? 'ABANDONO' : 'CONSTRUÇÃO';
}

function formatFrequencyLabel(frequency: string | null | undefined) {
  if (frequency === 'specific_days') return 'DIAS ESPECÍFICOS';
  if (frequency === 'weekly') return 'SEMANAL';
  return 'DIÁRIA';
}

function formatSpecificDays(days: number[] | null | undefined) {
  if (!Array.isArray(days) || days.length === 0) return 'Todos os dias';
  return days
    .slice()
    .sort((left, right) => left - right)
    .map((day) => WEEKDAY_OPTIONS.find((option) => option.value === day)?.label ?? String(day))
    .join(' · ');
}

function formatHabitActionLabel(habit: any, isDoneToday: boolean, isDueToday: boolean) {
  if (habit.is_paused) return 'PAUSADO';
  if (!isDueToday) return 'HOJE NÃO PREVISTO';
  if (habit.type === 'abandon') {
    return isDoneToday ? 'RESISTÊNCIA REGISTRADA' : 'MARCAR RESISTÊNCIA';
  }
  return isDoneToday ? 'CONCLUÍDO HOJE' : 'MARCAR COMO FEITO';
}

function shouldRequestNotificationPermission() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export default function Habits() {
  const { user, profile, refreshProfile } = useAuth();
  const { habits, loading, fetchHabits, markHabitCheckin, toggleHabitPause, stats } = useHabits();
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitType, setNewHabitType] = useState<'build' | 'abandon'>('build');
  const [newHabitFrequency, setNewHabitFrequency] = useState<'daily' | 'specific_days' | 'weekly'>('daily');
  const [newHabitSpecificDays, setNewHabitSpecificDays] = useState<number[]>([1, 3, 5]);
  const [newHabitTargetDays, setNewHabitTargetDays] = useState('7');
  const [actionLoading, setActionLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reminderEnabledDraft, setReminderEnabledDraft] = useState(false);
  const [reminderTimeDraft, setReminderTimeDraft] = useState('08:00');
  const [savingReminder, setSavingReminder] = useState(false);

  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  const reminderEnabled = Boolean(profile?.habit_reminder_enabled);
  const reminderTime = profile?.habit_reminder_time ?? '08:00';

  useEffect(() => {
    setReminderEnabledDraft(reminderEnabled);
    setReminderTimeDraft(reminderTime);
  }, [reminderEnabled, reminderTime]);

  const openHabitModal = () => {
    setPageError(null);
    setNewHabitName('');
    setNewHabitType('build');
    setNewHabitFrequency('daily');
    setNewHabitSpecificDays([1, 3, 5]);
    setNewHabitTargetDays('7');
    setIsAddingHabit(true);
  };

  const toggleHabitSpecificDay = (weekday: number) => {
    setNewHabitSpecificDays((current) => {
      if (current.includes(weekday)) {
        return current.filter((day) => day !== weekday);
      }

      return [...current, weekday].sort((left, right) => left - right);
    });
  };

  const handleAddHabit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = newHabitName.trim();
    const targetDays = Number(newHabitTargetDays);

    if (!user?.id) {
      setPageError('Sessão inválida. Refaça o login para criar hábitos.');
      return;
    }

    if (!trimmedName) {
      setPageError('Informe um nome para o hábito.');
      return;
    }

    if (!Number.isFinite(targetDays) || targetDays <= 0) {
      setPageError('A meta de dias precisa ser maior que zero.');
      return;
    }

    if (newHabitFrequency === 'specific_days' && newHabitSpecificDays.length === 0) {
      setPageError('Selecione pelo menos um dia da semana.');
      return;
    }

    setActionLoading(true);
    setPageError(null);

    try {
      const result: any = await withTimeout(
        supabase.from('habits').insert({
          aluno_id: user.id,
          name: trimmedName,
          type: newHabitType,
          frequency: newHabitFrequency,
          specific_days: newHabitFrequency === 'specific_days' ? newHabitSpecificDays : [],
          target_days: targetDays,
          is_paused: false,
          streak_reset_on: null,
        }),
        'criação do hábito'
      );
      const { error } = result;

      if (error) throw error;

      await fetchHabits();
      setIsAddingHabit(false);
    } catch (error) {
      setPageError(parseError(error, 'Não foi possível criar o hábito.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveReminder = async () => {
    if (!user?.id) {
      setPageError('Sessão inválida. Refaça o login para salvar o lembrete.');
      return;
    }

    if (reminderEnabledDraft && !shouldRequestNotificationPermission()) {
      setPageError('Seu navegador não suporta notificações web.');
      return;
    }

    if (reminderEnabledDraft && shouldRequestNotificationPermission()) {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

      if (permission !== 'granted') {
        setPageError('Permita notificações para ativar o lembrete diário.');
        return;
      }
    }

    setSavingReminder(true);
    setPageError(null);

    try {
      const result: any = await withTimeout(
        supabase
          .from('profiles')
          .update({
            habit_reminder_enabled: reminderEnabledDraft,
            habit_reminder_time: reminderEnabledDraft ? reminderTimeDraft : null,
          })
          .eq('id', user.id),
        'salvamento do lembrete'
      );
      const { error } = result;

      if (error) throw error;

      await refreshProfile();
    } catch (error) {
      setPageError(parseError(error, 'Não foi possível salvar o lembrete.'));
    } finally {
      setSavingReminder(false);
    }
  };

  const handleMarkToday = async (habit: any) => {
    if (habit.is_paused) return;

    setPageError(null);
    setActionLoading(true);

    try {
      const error = await withTimeout(markHabitCheckin(habit.id, todayKey, true), 'check-in do hábito');
      if (error) throw error;
    } catch (error) {
      setPageError(parseError(error, 'Não foi possível registrar o check-in.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseToggle = async (habit: any) => {
    setPageError(null);
    setActionLoading(true);

    try {
      const error = await withTimeout(toggleHabitPause(habit.id, !habit.is_paused), 'atualização do hábito');
      if (error) throw error;
    } catch (error) {
      setPageError(parseError(error, 'Não foi possível atualizar o hábito.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (habit: any) => {
    if (!window.confirm('Excluir este hábito?')) return;

    setPageError(null);
    setActionLoading(true);

    try {
      const result: any = await withTimeout(
        supabase.from('habits').delete().eq('id', habit.id),
        'remoção do hábito'
      );
      const { error } = result;

      if (error) throw error;

      await fetchHabits();
    } catch (error) {
      setPageError(parseError(error, 'Não foi possível excluir o hábito.'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">
          Carregando protocolos de hábitos
        </p>
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Sequência atual',
      value: `${stats.currentStreak ?? 0} dias`,
      hint: 'Maior streak ativo calculado por hábito.',
    },
    {
      label: 'Previstos hoje',
      value: `${stats.todayDueHabits ?? 0}`,
      hint: 'Hábitos que pedem check-in nesta data.',
    },
    {
      label: 'Concluídos hoje',
      value: `${stats.todayCompletedHabits ?? 0}`,
      hint: 'Check-ins efetivos já registrados.',
    },
    {
      label: 'Ativos agora',
      value: `${stats.activeHabits ?? habits.length}`,
      hint: `${stats.pausedHabits ?? 0} pausados no momento.`,
    },
  ];

  return (
    <div className="space-y-10 pb-12 font-sans text-white">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="mb-4 block text-[10px] font-black uppercase tracking-[0.4em] text-brand-green">
            Protocolo de Hábitos
          </span>
          <h1 className="text-6xl font-black italic uppercase leading-none tracking-tighter md:text-7xl">
            Check-in simples
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-neutral-500">
            Um fluxo único para marcar execução, resistência, pausa e lembrete diário sem trocar data manualmente.
          </p>
        </div>
        <button
          onClick={openHabitModal}
          className="inline-flex items-center gap-3 rounded-2xl bg-brand-green px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          Novo hábito
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{card.label}</p>
            <p className="mt-2 text-3xl font-black italic uppercase text-white">{card.value}</p>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{card.hint}</p>
          </div>
        ))}
      </section>

      <AnimatePresence>
        {pageError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-4 rounded-[28px] border border-red-500/30 bg-red-950/30 px-6 py-5"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-300">Falha na operação</p>
              <p className="mt-2 text-sm text-red-100/90">{pageError}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section id="habit-reminder" className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Lembrete diário</p>
            <h2 className="mt-2 text-2xl font-black italic uppercase tracking-tighter">Configuração do aluno</h2>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              O app grava sua preferência e dispara notificação local via PWA quando o navegador estiver autorizado.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveReminder}
            disabled={savingReminder}
            className="inline-flex items-center gap-2 rounded-2xl border border-brand-green/20 bg-brand-green/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green transition-all hover:bg-brand-green/15 disabled:opacity-50"
          >
            {savingReminder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Salvar lembrete
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_220px]">
          <label className="flex items-center justify-between rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Ativar lembrete</p>
              <p className="mt-2 text-xs text-neutral-500">
                {reminderEnabledDraft ? 'Notificação diária ligada.' : 'Notificação diária desligada.'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={reminderEnabledDraft}
              onChange={(event) => setReminderEnabledDraft(event.target.checked)}
              className="h-5 w-5 rounded border-[#1f1f1f] bg-[#050505] text-brand-green focus:ring-brand-green"
            />
          </label>

          <label className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Horário</p>
            <input
              type="time"
              value={reminderTimeDraft}
              onChange={(event) => setReminderTimeDraft(event.target.value)}
              className="mt-3 w-full bg-transparent text-2xl font-black italic uppercase tracking-tighter outline-none"
            />
          </label>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {habits.map((habit: any, index: number) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            index={index}
            today={today}
            todayKey={todayKey}
            onMarkToday={handleMarkToday}
            onTogglePause={handlePauseToggle}
            onDelete={handleDelete}
            busy={actionLoading}
          />
        ))}
      </div>

      {habits.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-[48px] border-2 border-dashed border-[#1a1a1a] bg-[#050505] px-6 py-20">
          <Target className="mb-6 h-12 w-12 text-neutral-800" />
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
            Nenhum protocolo ativo agora
          </p>
          <button
            onClick={openHabitModal}
            className="mt-8 rounded-2xl border border-brand-green/20 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green transition-colors hover:bg-brand-green/10"
          >
            Criar primeiro hábito
          </button>
        </div>
      )}

      {isAddingHabit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl rounded-[32px] border border-[#262626] bg-[#050505] p-8"
          >
            <button
              onClick={() => setIsAddingHabit(false)}
              className="absolute right-6 top-6 text-neutral-600 transition-colors hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>

            <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter">
              Novo
              <br />
              Protocolo
            </h2>
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-neutral-500">
              Cadastre tipo, frequência, dias e meta do hábito.
            </p>

            <form onSubmit={handleAddHabit} className="mt-8 space-y-6">
              <div>
                <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600">
                  Nome
                </label>
                <input
                  autoFocus
                  required
                  value={newHabitName}
                  onChange={(event) => setNewHabitName(event.target.value)}
                  className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-sm font-black uppercase tracking-widest outline-none transition-all placeholder:text-neutral-800 focus:border-brand-green"
                  placeholder="Ex: treino em jejum"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600">
                    Tipo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'build' as const, label: 'Construir' },
                      { value: 'abandon' as const, label: 'Abandonar' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setNewHabitType(option.value)}
                        className={cn(
                          'rounded-xl border py-4 text-xs font-black uppercase transition-all',
                          newHabitType === option.value
                            ? 'border-transparent brand-gradient text-black'
                            : 'border-[#1a1a1a] bg-[#0a0a0a] text-neutral-500'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600">
                    Frequência
                  </label>
                  <select
                    value={newHabitFrequency}
                    onChange={(event) => setNewHabitFrequency(event.target.value as 'daily' | 'specific_days' | 'weekly')}
                    className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-black uppercase tracking-widest outline-none focus:border-brand-green"
                  >
                    <option value="daily">Diária</option>
                    <option value="specific_days">Dias específicos</option>
                    <option value="weekly">Semanal</option>
                  </select>
                </div>

                <div>
                  <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600">
                    Meta de dias
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={newHabitTargetDays}
                    onChange={(event) => setNewHabitTargetDays(event.target.value)}
                    className="w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 text-sm font-black uppercase tracking-widest outline-none focus:border-brand-green"
                    placeholder="Ex: 7"
                  />
                </div>
              </div>

              {newHabitFrequency === 'specific_days' && (
                <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Dias selecionados</p>
                  <div className="mt-3 grid grid-cols-7 gap-2">
                    {WEEKDAY_OPTIONS.map((weekday) => {
                      const active = newHabitSpecificDays.includes(weekday.value);
                      return (
                        <button
                          key={weekday.value}
                          type="button"
                          onClick={() => toggleHabitSpecificDay(weekday.value)}
                          className={cn(
                            'rounded-xl border px-0 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all',
                            active
                              ? 'border-transparent brand-gradient text-black'
                              : 'border-[#1f1f1f] text-neutral-500 hover:border-brand-green/40 hover:text-white'
                          )}
                        >
                          {weekday.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-emerald-400" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                    Check-in direto
                  </p>
                </div>
                <p className="mt-3 text-xs text-neutral-500">
                  Hábito construído marca execução. Hábito de abandono marca resistência.
                </p>
              </div>

              <button
                disabled={actionLoading}
                className="w-full rounded-[24px] bg-brand-green py-5 text-xs font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98] disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Ativar protocolo'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

type HabitCardProps = {
  key?: React.Key;
  habit: any;
  today: Date;
  todayKey: string;
  index: number;
  onMarkToday: (habit: any) => Promise<void>;
  onTogglePause: (habit: any) => Promise<void>;
  onDelete: (habit: any) => Promise<void>;
  busy: boolean;
};

function HabitCard({ habit, today, todayKey, index, onMarkToday, onTogglePause, onDelete, busy }: HabitCardProps) {
  const isDoneToday = habit.checkins?.some((checkin: any) => checkin.date === todayKey && checkin.status);
  const isDueToday = isHabitDueOnDate(habit, today);
  const streak = calculateHabitStreak(habit, today);
  const heatmap = buildHabitHeatmap(habit, today);
  const consistency = buildHabitConsistency(habit, today);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex h-full flex-col rounded-[36px] border border-[#262626] bg-[#050505] p-6 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 text-brand-green">
            <Target className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-2xl font-black italic uppercase leading-none tracking-tighter text-white">
              {habit.name}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-600">
                {formatHabitType(habit.type)}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-700">/</span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-600">
                {formatFrequencyLabel(habit.frequency)}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-700">/</span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-600">
                {habit.target_days} DIAS
              </span>
              {habit.is_paused && (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">
                  Pausado
                </span>
              )}
            </div>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
              {habit.frequency === 'specific_days'
                ? formatSpecificDays(habit.specific_days)
                : 'Check-in direto no dia previsto'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onTogglePause(habit)}
            className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-3 text-neutral-600 transition-all hover:bg-[#141414] hover:text-white"
            title={habit.is_paused ? 'Retomar hábito' : 'Pausar hábito'}
          >
            {habit.is_paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onDelete(habit)}
            className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-3 text-neutral-600 transition-all hover:bg-[#141414] hover:text-white"
            title="Excluir hábito"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Hoje</p>
            <p className="mt-2 text-sm text-neutral-300">
              {isDueToday ? 'Dia previsto para check-in.' : 'Hoje não é dia previsto para este hábito.'}
            </p>
          </div>
          <button
            type="button"
            disabled={busy || habit.is_paused || isDoneToday || !isDueToday}
            onClick={() => onMarkToday(habit)}
            className={cn(
              'inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-all',
              habit.is_paused || !isDueToday
                ? 'cursor-not-allowed border border-[#1a1a1a] bg-[#050505] text-neutral-700'
                : isDoneToday
                  ? 'brand-gradient text-black'
                  : 'border border-[#1a1a1a] bg-[#050505] text-neutral-800 hover:border-brand-green/30 hover:text-white'
            )}
            title={formatHabitActionLabel(habit, isDoneToday, isDueToday)}
          >
            <CheckCircle2 className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-neutral-500">
              {formatHabitActionLabel(habit, isDoneToday, isDueToday)}
            </span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-700">
              {format(today, 'dd/MM/yyyy')}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black italic tracking-tighter text-white">{streak}</span>
            <p className="text-[8px] font-black uppercase tracking-widest leading-none text-neutral-600">Streak</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
            Heatmap de consistência
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
            {consistency}% real
          </p>
        </div>
        <div className="mt-4 grid grid-flow-col grid-rows-7 gap-1.5 auto-cols-fr">
          {heatmap.map((cell: any) => (
            <div
              key={cell.dateKey}
              title={`${cell.label} - ${cell.status === 'done' ? 'feito' : cell.status === 'missed' ? 'não feito' : 'não previsto'}`}
              className={cn(
                'aspect-square rounded-lg border transition-all',
                cell.status === 'done'
                  ? 'border-emerald-500/30 bg-emerald-500/80 shadow-[0_0_10px_rgba(62,207,142,0.18)]'
                  : cell.status === 'missed'
                    ? 'border-rose-500/30 bg-rose-500/70'
                    : 'border-[#1f1f1f] bg-[#101010]'
              )}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-600">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-emerald-500/30 bg-emerald-500/80" />
            Feito
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-rose-500/30 bg-rose-500/70" />
            Não feito
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-[#1f1f1f] bg-[#101010]" />
            Não previsto
          </span>
        </div>
      </div>
    </motion.article>
  );
}
