import { ArrowDownOnSquareStackIcon, ChartBarIcon } from "@/components/ui/icons";
import { goals } from "@/lib/mockData";
import { Chip } from "../ui/chip";
import { SectionCard } from "../ui/section-card";
import { TacticCard } from "./tactic-card";

export function GoalSection() {
  return (
    <div className="space-y-4">
      {goals.map((goal) => (
        <SectionCard
          key={goal.id}
          title={goal.title}
          description={goal.description}
          action={
            <div className="flex gap-2">
              <Chip tone="success">Score {goal.weeklyScore}%</Chip>
              <button className="badge bg-brand-500/20 text-brand-200">
                <ArrowDownOnSquareStackIcon className="h-4 w-4" />
              </button>
            </div>
          }
        >
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>
              Target: {goal.targetValue} {goal.metricUnit} · Atual: {goal.currentValue} {goal.metricUnit}
            </span>
            <span className="flex items-center gap-1">
              <ChartBarIcon className="h-4 w-4" />
              {goal.metricType === "leading" ? "Leading" : "Lagging"}
            </span>
          </div>
          <div className="space-y-3">
            {goal.tactics.map((tactic) => (
              <TacticCard key={tactic.id} tactic={tactic} />
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
