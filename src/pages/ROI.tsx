import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  Plus,
  DollarSign,
  Target,
  Loader2,
  X,
  History,
  Wallet,
  BarChart3,
  Settings2,
  ShieldAlert,
} from 'lucide-react';
import { endOfWeek, format, startOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useROI } from '../hooks/useData';
import { canViewFinancialROI, normalizeRole } from '../lib/roiAccess';
import { supabase } from '../lib/supabase';

const ACTION_TIMEOUT_MS = 8000;

function withTimeout(promise: any, label: string, timeoutMs = ACTION_TIMEOUT_MS): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} demorou demais para concluir. Tente novamente.`));
    }, timeoutMs);

    promise
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

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export default function ROI() {
  const { user, profile } = useAuth();
  const { results, baseline, activeCycle, hasFinancialAccess, addResult, fetchROI, loading } = useROI();
  const db: any = supabase;
  const [isAddingResult, setIsAddingResult] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [baseIncome, setBaseIncome] = useState('');
  const [baseInvestment, setBaseInvestment] = useState('0');
  const [baseGoal, setBaseGoal] = useState('');
  const [goalNote, setGoalNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const baselineIncome = Number(baseline?.baseline_income ?? baseline?.initial_revenue ?? 0) || 0;
  const investment = Number(baseline?.investment ?? 0) || 0;
  const goalIncome = Number(baseline?.goal_income ?? baseline?.target_revenue ?? 0) || 0;
  const totalRevenue = results.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const netProfit = totalRevenue - investment;
  const roiPercent = investment > 0 ? (netProfit / investment) * 100 : 0;
  const goalProgress = goalIncome > 0 ? (totalRevenue / goalIncome) * 100 : 0;
  const roiReady = !!baseline || totalRevenue > 0 || baselineIncome > 0 || goalIncome > 0;
  const currentCycleId = activeCycle?.id ?? baseline?.cycle_id ?? null;
  const canEditFinancialROI = hasFinancialAccess && canViewFinancialROI(profile?.role);
  const goalStatus = baseline?.goal_status ?? 'draft';
  const goalStatusLabel =
    goalStatus === 'approved'
      ? 'Meta aprovada'
      : goalStatus === 'proposed'
        ? 'Meta proposta'
        : goalStatus === 'rejected'
          ? 'Meta recusada'
          : 'Meta em rascunho';
  const weeklySeries = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 8 }, (_, index) => {
      const weekDate = subWeeks(today, 7 - index);
      const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 });
      const weekTotal = results.reduce((sum, result) => {
        const resultDate = new Date(result.date);
        if (resultDate >= weekStart && resultDate <= weekEnd) {
          return sum + Number(result.amount || 0);
        }
        return sum;
      }, 0);

      return {
        label: format(weekStart, 'dd/MM', { locale: ptBR }),
        total: weekTotal,
      };
    });
  }, [results]);
  const maxWeeklyTotal = weeklySeries.reduce((max, item) => Math.max(max, item.total), 0);

  const openAddModal = () => {
    setPageError(null);
    setAmount('');
    setDescription('');
    setIsAddingResult(true);
  };

  const openConfigModal = () => {
    setPageError(null);
    setBaseIncome(baselineIncome > 0 ? baselineIncome.toString() : '');
    setBaseInvestment(investment > 0 ? investment.toString() : '0');
    setBaseGoal(goalIncome > 0 ? goalIncome.toString() : '');
    setGoalNote(baseline?.goal_note ?? '');
    setIsConfiguring(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      setPageError('Sessão inválida. Refaça o login para lançar ROI.');
      return;
    }

    if (!canEditFinancialROI) {
      setPageError('Este papel não pode lançar resultados financeiros de ROI.');
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setPageError('Informe um valor válido maior que zero.');
      return;
    }

    if (!description.trim()) {
      setPageError('Informe uma descrição para o lançamento.');
      return;
    }

    if (!baseline?.id || !currentCycleId) {
      setPageError('Configure baseline e ciclo antes de lançar um resultado.');
      return;
    }

    if (baseline.cycle_id && baseline.cycle_id !== currentCycleId) {
      setPageError('O lançamento precisa usar a baseline do ciclo ativo.');
      return;
    }

    setActionLoading(true);
    setPageError(null);

    try {
      const result = await withTimeout(
        addResult(parsedAmount, description.trim(), format(new Date(), 'yyyy-MM-dd')),
        'lançamento de ROI'
      );

      if (result) {
        throw result;
      }

      setAmount('');
      setDescription('');
      setIsAddingResult(false);
      await fetchROI();
    } catch (error) {
      setPageError(parseError(error, 'Não foi possível registrar o lançamento.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfigureBaseline = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      setPageError('Sessão inválida. Refaça o login para salvar a base.');
      return;
    }

    const parsedIncome = Number(baseIncome);
    const parsedInvestment = Number(baseInvestment || 0);
    const parsedGoal = baseGoal.trim() === '' ? null : Number(baseGoal);

    if (!Number.isFinite(parsedIncome) || parsedIncome < 0) {
      setPageError('O baseline precisa ser um número válido.');
      return;
    }

    if (!Number.isFinite(parsedInvestment) || parsedInvestment < 0) {
      setPageError('O investimento precisa ser um número válido.');
      return;
    }

    if (parsedGoal !== null && (!Number.isFinite(parsedGoal) || parsedGoal < 0)) {
      setPageError('A meta precisa ser um número válido ou ficar em branco.');
      return;
    }

    if (!currentCycleId) {
      setPageError('Nenhum ciclo ativo encontrado para vincular a baseline.');
      return;
    }

    setActionLoading(true);
    setPageError(null);

    const payload = {
      aluno_id: user.id,
      cycle_id: currentCycleId,
      baseline_income: parsedIncome,
      investment: parsedInvestment,
      goal_income: parsedGoal,
      goal_status:
        parsedGoal === null
          ? 'draft'
          : normalizeRole(profile?.role) === 'TREINADOR' || normalizeRole(profile?.role) === 'SUPER_ADMIN'
            ? 'approved'
            : 'proposed',
      goal_note: goalNote.trim() || null,
      goal_proposed_by: parsedGoal === null ? null : user.id,
      goal_proposed_at: parsedGoal === null ? null : new Date().toISOString(),
      goal_approved_by:
        parsedGoal !== null &&
        (normalizeRole(profile?.role) === 'TREINADOR' || normalizeRole(profile?.role) === 'SUPER_ADMIN')
          ? user.id
          : null,
      goal_approved_at:
        parsedGoal !== null &&
        (normalizeRole(profile?.role) === 'TREINADOR' || normalizeRole(profile?.role) === 'SUPER_ADMIN')
          ? new Date().toISOString()
          : null,
    };

    try {
      const { data: existing, error: lookupError } = await withTimeout(
        db
          .from('roi_baselines')
          .select('id')
          .eq('aluno_id', user.id)
          .eq('cycle_id', currentCycleId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        'consulta da baseline'
      );

      if (lookupError) throw lookupError;

      if (existing?.id) {
        const { error } = await withTimeout(
          db.from('roi_baselines').update(payload).eq('id', existing.id),
          'atualização da baseline'
        );

        if (error) throw error;
      } else {
        const { error } = await withTimeout(
          db.from('roi_baselines').insert(payload),
          'criação da baseline'
        );

        if (error) throw error;
      }

      await fetchROI();
      setIsConfiguring(false);
    } catch (error) {
      setPageError(parseError(error, 'Não foi possível salvar a base financeira.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-12 pb-12 text-white font-sans">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-none mb-4">
            ROI Financeiro
          </h1>
          <p className="text-neutral-500 max-w-md text-sm font-bold tracking-tight">
            Monitoramento cirúrgico de conversão. Cada investimento deve replicar exponencialmente seu valor original.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={openConfigModal}
            disabled={!canEditFinancialROI}
            className="bg-[#050505] border border-[#262626] text-neutral-500 font-black text-[10px] tracking-widest uppercase px-8 py-5 rounded-2xl hover:text-white transition-all flex items-center gap-3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Settings2 className="w-5 h-5" />
            Configurar
          </button>
          <button
            onClick={openAddModal}
            disabled={!canEditFinancialROI || !baseline}
            className="brand-gradient text-black font-black text-xs tracking-widest uppercase px-10 py-5 rounded-2xl hover:scale-[0.98] transition-all flex items-center gap-3 shadow-lg shadow-brand-green/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="w-5 h-5" />
            Lançar Resultado
          </button>
        </div>
      </header>

      <AnimatePresence>
        {pageError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-4 rounded-[28px] border border-red-500/30 bg-red-950/30 px-6 py-5"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-300">
                Falha na operação
              </p>
              <p className="mt-2 text-sm text-red-100/90">{pageError}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && !canEditFinancialROI && (
        <div className="rounded-[32px] border border-[#262626] bg-[#050505] px-8 py-7 flex items-start gap-5">
          <ShieldAlert className="w-6 h-6 text-neutral-500 mt-1 shrink-0" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500 mb-3">
              ROI protegido
            </p>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none">
              Este papel não pode visualizar dados financeiros de ROI.
            </h2>
            <p className="mt-3 text-sm text-neutral-500 max-w-2xl">
              Apenas o próprio aluno, treinadores e super admin podem acessar baselines, lançamentos e metas financeiras.
            </p>
          </div>
        </div>
      )}

      {!loading && canEditFinancialROI && !baseline && (
        <div className="rounded-[32px] border border-dashed border-[#262626] bg-[#050505] px-8 py-7 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500 mb-3">
              Base não configurada
            </p>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none">
              Defina baseline, investimento e meta para liberar a leitura do ROI.
            </h2>
          </div>
          <button
            onClick={openConfigModal}
            className="brand-gradient text-black font-black text-[10px] tracking-[0.25em] uppercase px-6 py-4 rounded-2xl hover:scale-[0.98] transition-all"
          >
            Configurar agora
          </button>
        </div>
      )}

      {canEditFinancialROI && (
        <>
      {/* ROI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <SummaryCard
          label="Total gerado"
          value={`R$ ${totalRevenue.toLocaleString('pt-BR')}`}
          description="Resultado acumulado"
          icon={TrendingUp}
          highlight
        />
        <SummaryCard
          label="Investimento"
          value={`R$ ${investment.toLocaleString('pt-BR')}`}
          description="Capital aplicado"
          icon={DollarSign}
        />
        <SummaryCard
          label="Saldo"
          value={`R$ ${netProfit.toLocaleString('pt-BR')}`}
          description="Gerado menos investimento"
          icon={Wallet}
        />
        <SummaryCard
          label="Percentual"
          value={`${roiPercent.toFixed(1)}%`}
          description="Retorno sobre o investimento"
          icon={ArrowUpRight}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Recent History */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-[#050505] p-10 rounded-[32px] border border-[#262626]">
            <div className="flex flex-col gap-4 mb-10">
              <h3 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-4">
                <BarChart3 className="w-6 h-6 text-neutral-500" /> Evolução semanal
              </h3>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">
                Total gerado por semana nas últimas 8 semanas
              </p>
            </div>

            <div className="grid grid-cols-8 gap-3 items-end h-72">
              {weeklySeries.map((week) => {
                const height = maxWeeklyTotal > 0 ? Math.max(8, (week.total / maxWeeklyTotal) * 100) : 8;
                return (
                  <div key={week.label} className="flex h-full flex-col justify-end gap-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500 text-center">
                      R$ {week.total.toLocaleString('pt-BR')}
                    </div>
                    <div className="flex-1 flex items-end">
                      <div className="w-full rounded-t-2xl brand-gradient shadow-lg shadow-brand-green/20" style={{ height: `${height}%` }} />
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-600 text-center">
                      {week.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#050505] p-10 rounded-[32px] border border-[#262626]">
            <div className="flex flex-col gap-4 mb-10">
              <h3 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-4">
                <History className="w-6 h-6 text-neutral-500" /> Cronologia de Geração
              </h3>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">
                Use este histórico para acompanhar os lançamentos do seu ciclo
              </p>
            </div>

            <div className="space-y-4">
              {results.map((res) => (
                <div
                  key={res.id}
                  className="flex items-center justify-between p-8 bg-[#0a0a0a] border border-[#262626] rounded-3xl group hover:border-brand-green/50 transition-all"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-[#141414] border border-[#262626] rounded-2xl flex items-center justify-center font-mono font-bold text-brand-green text-sm">
                      +
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-tight group-hover:text-brand-green transition-all leading-none">
                        {res.description}
                      </h4>
                      <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mt-2">
                        {format(new Date(res.date), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black italic tracking-tighter text-white">
                      R$ {Number(res.amount || 0).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
              {results.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center">
                  <DollarSign className="w-12 h-12 text-neutral-900 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-700">
                    Nenhum resultado gerado até o momento
                  </p>
                  <button
                    onClick={openAddModal}
                    className="mt-8 px-6 py-4 rounded-2xl border border-brand-green/20 text-brand-green text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-green/10 transition-colors"
                  >
                    Lançar primeiro resultado
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-[#141414] p-10 rounded-[40px] border border-[#262626] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8">
              <Target className="w-16 h-16 text-brand-green opacity-10" />
            </div>
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-neutral-500 mb-2">
              Meta Financeira
            </p>
            <h4 className="text-5xl font-black tracking-tighter leading-none mb-10 italic">
              R$ {goalIncome.toLocaleString('pt-BR')}
            </h4>

            <div className="mb-8 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-brand-green">
                {goalStatusLabel}
              </span>
              <span className="rounded-full border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
                {activeCycle ? `Ciclo #${activeCycle.number}` : 'Sem ciclo ativo'}
              </span>
            </div>

            {baseline?.goal_note && (
              <div className="mb-8 rounded-2xl border border-[#262626] bg-[#0a0a0a] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2">
                  Observação da negociação
                </p>
                <p className="text-sm text-neutral-300 leading-relaxed">{baseline.goal_note}</p>
              </div>
            )}

            <div className="space-y-8">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-mono text-neutral-400">STATUS DA EXECUÇÃO</span>
                <span className="text-2xl font-black text-brand-green tracking-tighter">
                  {goalProgress.toFixed(1)}%
                </span>
              </div>
              <div className="h-6 w-full bg-[#0a0a0a] border border-[#262626] rounded-full overflow-hidden p-1.5">
                <div
                  className="h-full bg-brand-green rounded-full shadow-lg shadow-brand-green/40 transition-all duration-1000"
                  style={{ width: `${Math.min(100, goalProgress)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[#262626] bg-[#0a0a0a] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2">
                    Lucro líquido
                  </p>
                  <p className="text-xl font-black italic tracking-tighter">
                    R$ {netProfit.toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#262626] bg-[#0a0a0a] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2">
                    Meta / Base
                  </p>
                  <p className="text-xl font-black italic tracking-tighter">
                    {baselineIncome > 0 ? (goalIncome / baselineIncome).toFixed(2) : '0.00'}x
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button className="w-full bg-white text-black py-6 rounded-2xl font-black text-xs tracking-[0.3em] uppercase hover:scale-[0.98] transition-all shadow-xl shadow-white/5">
            Gerar Relatório de Performance
          </button>
        </div>
      </div>
        </>
      )}

      {/* Modal Lançar Resultado */}
      {isAddingResult && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#050505] border border-[#262626] rounded-[32px] p-10 relative"
          >
            <button
              onClick={() => setIsAddingResult(false)}
              className="absolute top-8 right-8 text-neutral-600 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2 leading-none">
              Lançar
              <br />
              Faturamento
            </h2>
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-10">
              Registre o novo faturamento gerado no período
            </p>

            <form onSubmit={handleAddSubmit} className="space-y-8">
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-4 tracking-[0.2em] ml-1">
                  Valor do Montante (R$)
                </label>
                <input
                  type="number"
                  autoFocus
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 text-2xl font-black uppercase tracking-tighter italic text-brand-green focus:border-brand-green outline-none transition-all placeholder:text-neutral-800"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-4 tracking-[0.2em] ml-1">
                  Origem da Venda / Descrição
                </label>
                <input
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 text-sm font-black uppercase tracking-widest focus:border-brand-green outline-none transition-all placeholder:text-neutral-800"
                  placeholder="EX: UPGRADE MENTORIA"
                />
              </div>
              <button
                disabled={actionLoading}
                className="w-full brand-gradient py-6 rounded-[24px] text-black font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-brand-green/20 hover:scale-[0.98] transition-all disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'CONFIRMAR RECEITA'}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal Configurar Baseline */}
      {isConfiguring && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#050505] border border-[#262626] rounded-[32px] p-10 relative"
          >
            <button
              onClick={() => setIsConfiguring(false)}
              className="absolute top-8 right-8 text-neutral-600 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2 leading-none">
              Ajustar
              <br />
              Base
            </h2>
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-10">
              Baseline, investimento e meta alinhados ao schema de dev
            </p>

            <form onSubmit={handleConfigureBaseline} className="space-y-8">
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-4 tracking-[0.2em] ml-1">
                  Baseline de Receita
                </label>
                <input
                  type="number"
                  autoFocus
                  required
                  value={baseIncome}
                  onChange={(e) => setBaseIncome(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 text-sm font-black uppercase tracking-widest focus:border-brand-green outline-none transition-all placeholder:text-neutral-800"
                  placeholder="EX: 15000"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-4 tracking-[0.2em] ml-1">
                  Investimento Inicial
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={baseInvestment}
                  onChange={(e) => setBaseInvestment(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 text-sm font-black uppercase tracking-widest focus:border-brand-green outline-none transition-all placeholder:text-neutral-800"
                  placeholder="EX: 5000"
                />
                <p className="mt-3 text-[10px] font-medium text-neutral-600 uppercase tracking-[0.2em]">
                  Campo opcional. O schema aceita `0` como padrão.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-4 tracking-[0.2em] ml-1">
                  Meta de Faturamento
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={baseGoal}
                  onChange={(e) => setBaseGoal(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 text-sm font-black uppercase tracking-widest focus:border-brand-green outline-none transition-all placeholder:text-neutral-800"
                  placeholder="EX: 50000"
                />
                <p className="mt-3 text-[10px] font-medium text-neutral-600 uppercase tracking-[0.2em]">
                  Campo opcional, salvo em `goal_income`.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-4 tracking-[0.2em] ml-1">
                  Observação da negociação
                </label>
                <textarea
                  value={goalNote}
                  onChange={(e) => setGoalNote(e.target.value)}
                  className="w-full min-h-[120px] bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 text-sm font-black uppercase tracking-widest focus:border-brand-green outline-none transition-all placeholder:text-neutral-800"
                  placeholder="Ex: Meta validada com o treinador"
                />
              </div>
              <button
                disabled={actionLoading}
                className="w-full brand-gradient py-6 rounded-[24px] text-black font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-brand-green/20 hover:scale-[0.98] transition-all disabled:opacity-50"
              >
                {actionLoading
                  ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  : normalizeRole(profile?.role) === 'TREINADOR' || normalizeRole(profile?.role) === 'SUPER_ADMIN'
                    ? 'SALVAR E APROVAR'
                    : 'SALVAR PROPOSTA'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, description, icon: Icon, highlight }: any) {
  return (
    <div
      className={cn(
        'p-10 rounded-[40px] border transition-all flex flex-col justify-center',
        highlight ? 'brand-gradient text-black' : 'bg-[#0d0d0d] border-[#262626] text-white'
      )}
    >
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center mb-10',
          highlight ? 'bg-black/10' : 'bg-neutral-800'
        )}
      >
        <Icon className={cn('w-6 h-6', highlight ? 'text-black' : 'text-brand-green')} />
      </div>
      <p
        className={cn(
          'text-[10px] uppercase font-black tracking-[0.2em] mb-2',
          highlight ? 'text-black/60' : 'text-neutral-500'
        )}
      >
        {label}
      </p>
      <h3 className="text-4xl font-black tracking-tighter uppercase leading-none mb-2 italic">{value}</h3>
      <p className={cn('text-[10px] font-mono', highlight ? 'text-black/40' : 'text-neutral-600')}>
        {description}
      </p>
    </div>
  );
}
