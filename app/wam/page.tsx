import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { WamAgendaCard } from "@/components/wam/wam-agenda";

export default function WamPage() {
  return (
    <main className="space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="badge bg-white/10 text-white">
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">WAM - Weekly Accountability Meeting</h1>
          <p className="text-sm text-slate-300">Roteiro guiado para pontuar, revisar e planejar a próxima semana.</p>
        </div>
      </header>
      <WamAgendaCard />
    </main>
  );
}
