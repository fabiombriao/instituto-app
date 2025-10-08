import { ClipboardDocumentCheckIcon, ClockIcon, SparklesIcon } from "@/components/ui/icons";
import { wamAgenda } from "@/lib/mockData";
import { SectionCard } from "../ui/section-card";

export function WamAgendaCard() {
  return (
    <div className="space-y-4">
      <SectionCard title="Passo 1" description="Revisar score da semana anterior">
        <div className="flex items-center justify-between rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-success">
          <div>
            <p className="text-xs uppercase tracking-[0.2em]">Score anterior</p>
            <p className="text-lg font-semibold">{wamAgenda.pastScore}%</p>
          </div>
          <SparklesIcon className="h-6 w-6" />
        </div>
      </SectionCard>
      <SectionCard title="Passo 2" description="Retrospectiva guiada (3 perguntas)">
        <ul className="space-y-3 text-sm text-slate-200">
          <li>
            <strong className="text-white">Funcionou?</strong> {wamAgenda.retrospective.worked}
          </li>
          <li>
            <strong className="text-white">Travou?</strong> {wamAgenda.retrospective.blocked}
          </li>
          <li>
            <strong className="text-white">Ajustes?</strong> {wamAgenda.retrospective.adjustments}
          </li>
        </ul>
      </SectionCard>
      <SectionCard title="Passo 3" description="Escolher 3 prioridades e confirmar agenda">
        <div className="space-y-4">
          <div>
            <p className="section-title">Três grandes</p>
            <ul className="mt-2 space-y-2 text-sm text-white">
              {wamAgenda.bigThree.map((item) => (
                <li key={item} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                  <ClipboardDocumentCheckIcon className="mr-2 inline h-4 w-4 text-brand-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="section-title">Blocos confirmados</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-200">
              {wamAgenda.calendarBlocks.map((block) => (
                <li key={block} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                  <ClockIcon className="h-4 w-4 text-brand-200" /> {block}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Passo 4" description="Gerar ata e compartilhar com o time">
        <button className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/40">
          Gerar ata e enviar
        </button>
      </SectionCard>
    </div>
  );
}
