import { ArrowTrendingUpIcon, DocumentArrowDownIcon, FireIcon } from "@/components/ui/icons";
import { weeklyScores } from "@/lib/mockData";

const highlights = [
  {
    title: "Habits heatmap",
    description: "Streak médio de 8 dias nas táticas críticas.",
    icon: FireIcon
  },
  {
    title: "Ranking de impacto",
    description: "Prospectar 50 leads responde por 40% do score semanal.",
    icon: ArrowTrendingUpIcon
  }
];

export function InsightCards() {
  const lastScore = weeklyScores.at(-1)?.scorePct ?? 0;

  return (
    <section className="space-y-3">
      <div className="card flex items-center justify-between">
        <div>
          <p className="section-title">Score atual</p>
          <p className="text-2xl font-semibold text-white">{lastScore}%</p>
        </div>
        <button className="badge bg-brand-500/20 text-brand-200">
          <DocumentArrowDownIcon className="h-4 w-4" /> Exportar CSV
        </button>
      </div>
      {highlights.map((item) => (
        <article key={item.title} className="card flex items-start gap-3">
          <item.icon className="h-6 w-6 text-brand-300" />
          <div>
            <h3 className="text-sm font-semibold text-white">{item.title}</h3>
            <p className="text-xs text-slate-300">{item.description}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
