import { ReactNode } from "react";

interface ChipProps {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneStyles: Record<NonNullable<ChipProps["tone"]>, string> = {
  default: "bg-white/10 text-white",
  success: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  danger: "bg-danger/20 text-danger"
};

export function Chip({ children, tone = "default" }: ChipProps) {
  return <span className={`badge ${toneStyles[tone]}`}>{children}</span>;
}
