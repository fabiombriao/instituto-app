interface ScoreBadgeProps {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger";
}

const toneColor: Record<NonNullable<ScoreBadgeProps["tone"]>, string> = {
  success: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  danger: "bg-danger/20 text-danger"
};

export function ScoreBadge({ label, value, tone = "success" }: ScoreBadgeProps) {
  return (
    <div className={`card flex items-center justify-between gap-3 px-4 py-3 ${toneColor[tone]}`}>
      <div>
        <p className="text-xs uppercase tracking-wider text-white/70">{label}</p>
        <p className="text-lg font-semibold text-white">{value}%</p>
      </div>
      <span className="badge bg-white/20 text-white">score</span>
    </div>
  );
}
