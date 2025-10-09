# 12 Week Year Method

Aplicativo web mobile-first para transformar metas anuais em ciclos intensos de 12 semanas. O protótipo entregue neste repositório usa Next.js (App Router) + Tailwind CSS + Recharts e inclui fluxos essenciais do método.

## 🧱 Estrutura do projeto
- `app/` – Páginas com App Router (Semana atual, Onboarding, WAM, Ciclo, Relatórios, Templates).
- `components/` – Componentes reutilizáveis (UI, dashboard, onboarding, relatórios, templates, navegação).
- `lib/` – Tipagens e dados mockados.
- `docs/` – Manual de rituais para conduzir o WAM e calcular score.

## 🚀 Como rodar
```bash
npm install
npm run dev
```
O app ficará disponível em `http://localhost:3000`.

## 📲 Fluxos contemplados (MVP)
- **Onboarding guiado (20 min)**: visão, objetivos, métricas e táticas.
- **Semana atual**: progresso do ciclo, prioridades, objetivos e táticas com score.
- **WAM**: roteiro passo a passo com retrospectiva, grandes prioridades e ata.
- **Relatórios**: gráfico de evolução do score e cartões de insights.
- **Templates**: kits prontos para Vendas, Conteúdo, Operações, Saúde e Finanças.

## 🔌 Integrações previstas
- Google Calendar para blocos de WAM/foco.
- Supabase para Auth/Postgres/RLS/Storage.
- Webhooks via n8n (`week.start`, `week.end`, `score.updated`).

## 🛣️ Próximas evoluções sugeridas
1. Times & permissões (Owner, Líder, Membro, Coach) e score compartilhado.
2. AI Coach para gerar plano inicial e sugerir ajustes semanais.
3. Gamificação (streaks, badges, ranking privado) + PWA offline-first.

## 📄 Recursos adicionais
- [Manual de Rituais](docs/rituais.md) com passo a passo de execução semanal e cálculo de score.
