import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { TemplateLibrary } from "@/components/templates/template-library";

export default function TemplatesPage() {
  return (
    <main className="space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="badge bg-white/10 text-white">
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">Templates prontos</h1>
          <p className="text-sm text-slate-300">Aplique kits de objetivos e métricas com um clique e personalize depois.</p>
        </div>
      </header>
      <TemplateLibrary />
    </main>
  );
}
