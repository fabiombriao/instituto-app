import { CheckIcon, FireIcon } from "@/components/ui/icons";
import { Tactic } from "@/lib/types";
import { Chip } from "../ui/chip";
import { Progress } from "../ui/progress";

interface TacticCardProps {
  tactic: Tactic;
}

const trendCopy: Record<Tactic["trend"], string> = {
  up: "Subindo",
  down: "Caindo",
  steady: "Estável"
};

export function TacticCard({ tactic }: TacticCardProps) {
  const completion = Math.round(tactic.completion * 100);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{tactic.title}</p>
          <p className="text-xs text-slate-300">Peso {tactic.weight}% · {tactic.cadenceWeekly}x/semana</p>
        </div>
        <Chip tone={tactic.trend === "down" ? "warning" : "success"}>{trendCopy[tactic.trend]}</Chip>
      </div>
      <div className="mt-3 space-y-2">
        <Progress value={tactic.completion} label="Cumprimento" />
        <p className="text-xs text-slate-300">{completion}% da meta semanal</p>
      </div>
      {tactic.behaviorType === "habit" && tactic.habits?.length ? (
        <div className="mt-4 space-y-2">
          {tactic.habits.map((habit) => (
            <div key={habit.id} className="flex items-center justify-between text-xs text-slate-200">
              <div className="flex items-center gap-2">
                <FireIcon className="h-4 w-4 text-warning" />
                <span>{habit.title}</span>
              </div>
              <span>
                {Math.round(habit.progress * 100)}% · streak {habit.streak}x
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {tactic.tasks?.length ? (
        <ul className="mt-4 space-y-2 text-xs text-slate-200">
          {tactic.tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckIcon className={`h-4 w-4 ${task.status === "done" ? "text-success" : "text-white/50"}`} />
                <span>{task.title}</span>
              </div>
              <span className="text-white/60">{task.status === "done" ? "Feito" : "Pendente"}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {tactic.notes ? <p className="mt-3 text-xs text-warning/90">{tactic.notes}</p> : null}
    </div>
  );
}
