import { ArrowDownTrayIcon, SparklesIcon } from "@/components/ui/icons";
import { templateKits } from "@/lib/mockData";

export function TemplateLibrary() {
  return (
    <section className="space-y-3">
      {templateKits.map((kit) => (
        <article key={kit.id} className="card space-y-3">
          <header className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">{kit.name}</h3>
              <p className="text-xs text-slate-300">{kit.focus}</p>
            </div>
            <button className="badge bg-brand-500/20 text-brand-200">
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
          </header>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="section-title">Leading</p>
              <ul className="mt-1 space-y-1">
                {kit.leading.map((item) => (
                  <li key={item} className="rounded-lg bg-white/10 px-3 py-1 text-white">
                    <SparklesIcon className="mr-1 inline h-4 w-4 text-brand-200" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="section-title">Lagging</p>
              <ul className="mt-1 space-y-1">
                {kit.lagging.map((item) => (
                  <li key={item} className="rounded-lg bg-white/10 px-3 py-1 text-white/80">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
