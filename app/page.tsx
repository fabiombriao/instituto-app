import Link from "next/link";
import { ArrowRightIcon, CalendarIcon } from "@/components/ui/icons";
import { WeekProgress } from "@/components/dashboard/week-progress";
import { GoalSection } from "@/components/dashboard/goal-section";

export default function HomePage() {
  return (
    <main>
      <header className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Semana Atual</h1>
            <p className="text-sm text-slate-300">Foco intenso, execução diária e score em tempo real.</p>
          </div>
          <Link href="/wam" className="badge bg-brand-500/20 text-brand-100 transition hover:bg-brand-500/30">
            <CalendarIcon className="h-4 w-4" /> WAM
          </Link>
        </div>
        <div className="grid gap-4">
          <WeekProgress />
          <Link href="/onboarding" className="card flex items-center justify-between bg-brand-500/10">
            <div>
              <p className="section-title">Primeiro ciclo?</p>
              <p className="text-sm text-white">Faça o onboarding guiado em 20 minutos.</p>
            </div>
            <ArrowRightIcon className="h-5 w-5 text-brand-200" />
          </Link>
        </div>
      </header>
      <section className="space-y-4">
        <h2 className="section-title">Objetivos & Táticas</h2>
        <GoalSection />
      </section>
    </main>
  );
}
