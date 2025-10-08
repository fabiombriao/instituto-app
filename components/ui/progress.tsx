interface ProgressProps {
  value: number;
  label?: string;
}

export function Progress({ value, label }: ProgressProps) {
  return (
    <div className="space-y-1">
      {label ? <p className="text-xs text-slate-300">{label}</p> : null}
      <div className="progress-bar">
        <span style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}
