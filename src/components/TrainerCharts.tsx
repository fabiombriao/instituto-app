import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTurmaWeeklyScores, TurmaWeeklyScoreData } from '../hooks/useTurmaWeeklyScores';

interface TrainerChartsProps {
  turmaId: string | null;
  className?: string;
}

interface ChartDataPoint {
  week: string;
  weekNumber: number;
  [key: string]: string | number | null;
}

function generatePalette(count: number): string[] {
  const colors = [
    '#10b981', // emerald-500
    '#3b82f6', // blue-500
    '#f59e0b', // amber-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
    '#f97316', // orange-500
    '#6366f1', // indigo-500
    '#84cc16', // lime-500
    '#06b6d4', // cyan-500
    '#eab308', // yellow-500
    '#d946ef', // fuchsia-500
  ];
  return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
}

function truncateName(name: string | null | undefined, maxLength = 12): string {
  if (!name) return 'Sem nome';
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 2) + '..';
}

function formatTooltipLabel(label: any, payload: any): string {
  if (payload && payload.length > 0) {
    const weekNumber = payload[0]?.payload?.weekNumber;
    return `Semana ${weekNumber}`;
  }
  return `Semana ${label}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const weekNumber = payload[0]?.payload?.weekNumber;

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-3">
        Semana {weekNumber}
      </p>
      <div className="space-y-2">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs font-medium text-neutral-300">{entry.name}</span>
            </div>
            <span className="text-sm font-black text-white">{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrainerCharts({ turmaId, className }: TrainerChartsProps) {
  const { weeklyScoresData, loading, error } = useTurmaWeeklyScores(turmaId);

  const { chartData, linesConfig, averageData } = useMemo(() => {
    if (weeklyScoresData.length === 0) {
      return { chartData: [], linesConfig: [], averageData: [] };
    }

    // Encontrar o número máximo de semanas
    const maxWeek = Math.max(
      ...weeklyScoresData.flatMap((data) => data.scores.map((s) => s.week_number)),
      0
    );

    // Criar pontos de dados para cada semana
    const data: ChartDataPoint[] = Array.from({ length: maxWeek }, (_, index) => {
      const weekNumber = index + 1;
      const point: ChartDataPoint = {
        week: `S${weekNumber}`,
        weekNumber,
      };

      // Adicionar score de cada aluno para esta semana
      weeklyScoresData.forEach((studentData) => {
        const weekScore = studentData.scores.find((s) => s.week_number === weekNumber);
        const key = `student_${studentData.alunoId}`;
        point[key] = weekScore?.score ?? null;
      });

      return point;
    });

    // Calcular média da turma para cada semana
    const averagePoints = data.map((point) => {
      const validScores = Object.entries(point)
        .filter(([key]) => key.startsWith('student_'))
        .map(([, value]) => value as number | null)
        .filter((score): score is number => score !== null);

      const average =
        validScores.length > 0
          ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length)
          : null;

      return {
        ...point,
        average: average,
      };
    });

    // Configurar linhas para cada aluno
    const colors = generatePalette(weeklyScoresData.length);
    const lines = weeklyScoresData.map((studentData, index) => ({
      dataKey: `student_${studentData.alunoId}`,
      name: truncateName(studentData.profile?.full_name) || 'Aluno',
      color: colors[index],
      connectNulls: false,
    }));

    return {
      chartData: averagePoints,
      linesConfig: lines,
      averageData: averagePoints,
    };
  }, [weeklyScoresData]);

  if (loading) {
    return (
      <div className={cn('bg-[#050505] rounded-[32px] border border-[#1a1a1a] p-10', className)}>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-green mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
            Carregando dados da turma...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-[#050505] rounded-[32px] border border-[#1a1a1a] p-10', className)}>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-sm text-red-400 font-medium mb-2">Erro ao carregar dados</p>
          <p className="text-[10px] font-mono text-neutral-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!turmaId) {
    return (
      <div className={cn('bg-[#050505] rounded-[32px] border border-[#1a1a1a] p-10', className)}>
        <div className="flex flex-col items-center justify-center py-20">
          <TrendingUp className="w-12 h-12 text-neutral-900 mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-700">
            Selecione uma turma para visualizar os gráficos
          </p>
        </div>
      </div>
    );
  }

  if (weeklyScoresData.length === 0) {
    return (
      <div className={cn('bg-[#050505] rounded-[32px] border border-[#1a1a1a] p-10', className)}>
        <div className="flex flex-col items-center justify-center py-20">
          <TrendingUp className="w-12 h-12 text-neutral-900 mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-700">
            Nenhum dado de score semanal disponível para esta turma
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-[#050505] rounded-[32px] border border-[#1a1a1a] p-10', className)}>
      <div className="flex flex-col gap-4 mb-10">
        <h3 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-4 text-white">
          <TrendingUp className="w-6 h-6 text-neutral-500" />
          Evolução Semanal da Turma
        </h3>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">
          Scores semanais por aluno e média da turma
        </p>
      </div>

      <div className="h-[450px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis
              dataKey="week"
              stroke="#525252"
              tick={{ fill: '#737373', fontSize: 10, fontWeight: 'bold' }}
              tickLine={{ stroke: '#262626' }}
              axisLine={{ stroke: '#262626' }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#525252"
              tick={{ fill: '#737373', fontSize: 10, fontWeight: 'bold' }}
              tickLine={{ stroke: '#262626' }}
              axisLine={{ stroke: '#262626' }}
              label={{
                value: 'Score (%)',
                angle: -90,
                position: 'insideLeft',
                fill: '#525252',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={60}
              iconType="circle"
              wrapperStyle={{
                fontSize: '10px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            />

            {/* Linha da média da turma (destacada) */}
            <Line
              type="monotone"
              dataKey="average"
              name="Média da Turma"
              stroke="#ffffff"
              strokeWidth={4}
              strokeDasharray="8 4"
              dot={{ fill: '#ffffff', r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />

            {/* Linhas individuais dos alunos */}
            {linesConfig.map((config) => (
              <Line
                key={config.dataKey}
                type="monotone"
                dataKey={config.dataKey}
                name={config.name}
                stroke={config.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: config.color, strokeWidth: 2 }}
                connectNulls={config.connectNulls}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Resumo estatístico */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0a0a0a] rounded-2xl border border-[#1a1a1a] p-6">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600 mb-2">
            Total de Alunos
          </p>
          <p className="text-3xl font-black italic text-white">{weeklyScoresData.length}</p>
        </div>

        <div className="bg-[#0a0a0a] rounded-2xl border border-[#1a1a1a] p-6">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600 mb-2">
            Média Atual da Turma
          </p>
          <p className="text-3xl font-black italic text-brand-green">
            {averageData.length > 0
              ? `${averageData[averageData.length - 1]?.average ?? 0}%`
              : '0%'}
          </p>
        </div>

        <div className="bg-[#0a0a0a] rounded-2xl border border-[#1a1a1a] p-6">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600 mb-2">
            Semanas Registradas
          </p>
          <p className="text-3xl font-black italic text-white">{chartData.length}</p>
        </div>
      </div>
    </div>
  );
}
