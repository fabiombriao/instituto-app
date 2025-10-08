import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { PersonaCards } from "@/components/onboarding/persona-cards";

export default function OnboardingPage() {
  return (
    <main className="space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="badge bg-white/10 text-white">
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">Onboarding guiado</h1>
          <p className="text-sm text-slate-300">20 minutos para montar visão, objetivos e táticas do primeiro ciclo.</p>
        </div>
      </header>
      <OnboardingFlow />
      <section className="space-y-3">
        <h2 className="section-title">Quem usa</h2>
        <PersonaCards />
      </section>
      <section className="card space-y-2">
        <h3 className="text-sm font-semibold text-white">Integrações essenciais</h3>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
          <li>Google Calendar para blocos de WAM e foco profundo.</li>
          <li>Supabase para Auth, Postgres e armazenamento das atas.</li>
          <li>Webhooks n8n (week.start, week.end, score.updated).</li>
        </ul>
      </section>
    </main>
  );
}
