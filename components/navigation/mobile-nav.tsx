"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartPieIcon, ClockIcon, HomeIcon, RectangleGroupIcon, Squares2X2Icon } from "@/components/ui/icons";

const links = [
  { href: "/", label: "Semana", icon: HomeIcon },
  { href: "/ciclo", label: "Ciclo", icon: ClockIcon },
  { href: "/wam", label: "WAM", icon: RectangleGroupIcon },
  { href: "/relatorios", label: "Relatórios", icon: ChartPieIcon },
  { href: "/templates", label: "Templates", icon: Squares2X2Icon }
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4">
      <ul className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-900/90 p-2 shadow-lg shadow-slate-900/60 backdrop-blur">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`flex flex-col items-center rounded-xl px-3 py-2 text-xs font-medium transition ${
                  isActive ? "bg-brand-500/20 text-brand-200" : "text-slate-300"
                }`}
              >
                <Icon className="mb-1 h-5 w-5" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
