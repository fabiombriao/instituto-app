import { ArrowTrendingUpIcon } from "@/components/ui/icons";
import { cycleSummary } from "@/lib/mockData";
import { Chip } from "../ui/chip";

export function WeekProgress() {
  const progressPct = Math.round((cycleSummary.currentWeek / cycleSummary.totalWeeks) * 100);
  const lastScore = cycleSummary.scoreTrend.at(-1) ?? 0;

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-title">Semana atual</p>
          <h2 className="text-2xl font-semibold text-white">
            Semana {cycleSummary.currentWeek} / {cycleSummary.totalWeeks}
          </h2>
        </div>
        <Chip tone="success">
          <ArrowTrendingUpIcon className="mr-1 h-4 w-4" />
          {lastScore}%
        </Chip>
      </div>
      <div className="space-y-2">
        <div className="progress-bar">
          <span style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-xs text-slate-300">
          Ciclo <strong>{cycleSummary.name}</strong> · {progressPct}% concluído
        </p>
      </div>
    </section>
  );
}
