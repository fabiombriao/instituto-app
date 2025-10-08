import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { GoalSection } from "@/components/dashboard/goal-section";
import { ScoreChart } from "@/components/dashboard/score-chart";

export default function CyclePage() {
  return (
    <main className="space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="badge bg-white/10 text-white">
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">Ciclo 12 semanas</h1>
          <p className="text-sm text-slate-300">Visão, objetivos, táticas e métricas leading/lagging num só lugar.</p>
        </div>
      </header>
      <ScoreChart />
      <section className="space-y-3">
        <h2 className="section-title">Objetivos do ciclo</h2>
        <GoalSection />
      </section>
    </main>
  );
}
