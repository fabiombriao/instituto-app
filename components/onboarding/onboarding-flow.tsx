import Link from "next/link";
import { ArrowRightIcon, CheckCircleIcon, SparklesIcon } from "@/components/ui/icons";

const steps = [
  {
    title: "Visão brutalmente clara",
    description: "Defina em 3-5 frases a visão que orienta o ciclo.",
    icon: SparklesIcon
  },
  {
    title: "Metas do ciclo",
    description: "Escolha até 5 objetivos com métricas leading/lagging.",
    icon: CheckCircleIcon
  },
  {
    title: "Táticas e hábitos",
    description: "Cadencie ações semanais com pesos e regras de pontuação.",
    icon: ArrowRightIcon
  }
];

export function OnboardingFlow() {
  return (
    <section className="space-y-6">
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-white">Onboarding 20 minutos</h2>
        <p className="text-sm text-slate-300">
          Em menos de meia hora você sai com o ciclo desenhado, plano semanal gerado e score pronto para a primeira semana.
        </p>
      </div>
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.title} className="card flex items-center gap-3">
            <step.icon className="h-6 w-6 text-brand-300" />
            <div>
              <p className="text-sm font-semibold text-white">{step.title}</p>
              <p className="text-xs text-slate-300">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link
        href="/"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/40"
      >
        Iniciar meu ciclo agora <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </section>
  );
}
