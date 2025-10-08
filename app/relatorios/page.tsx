import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { ScoreChart } from "@/components/dashboard/score-chart";
import { InsightCards } from "@/components/reports/insight-cards";

export default function ReportsPage() {
  return (
    <main className="space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="badge bg-white/10 text-white">
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">Relatórios & Score</h1>
          <p className="text-sm text-slate-300">Visualize a evolução das 12 semanas, leading vs. lagging e exporte dados.</p>
        </div>
      </header>
      <ScoreChart />
      <InsightCards />
    </main>
  );
}
