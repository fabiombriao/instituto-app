import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { MobileNav } from "@/components/navigation/mobile-nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "12 Week Year Method",
  description:
    "Planeje ciclos de 12 semanas, execute com foco semanal e mensure progresso em tempo real.",
  metadataBase: new URL("https://12weekyear.app")
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="bg-slate-950">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.3) 0, transparent 45%), radial-gradient(circle at 80% 0%, rgba(30,64,175,0.25) 0, transparent 55%)"
            }}
          />
          <div className="relative z-10 pb-28">{children}</div>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
