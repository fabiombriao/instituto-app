# Performance e Limites do PRD

Linha de base de performance do app Caminhos do Exito + procedimento para
medicao continua. Referencia: secao 6.2 do PRD.

## Metas (PRD secao 6.2)

| Metrica | Meta | Estado atual |
|---------|------|--------------|
| LCP em 4G | < 2.5s | A medir com Lighthouse |
| Check-in (habito/tarefa) | < 500ms | OK em dev local; offline queue garante feedback < 50ms |
| Dashboard com 50 alunos | < 3s | A medir com fixture grande |
| Limite de monitor por graduado | Configuravel via super admin | Implementado (M7) |
| Limite de turma | Sem hard limit, soft = capacidade do treinador | Validar com 50 alunos |

## Como medir

### 1. Bundle size

```bash
npm run build
ls -lh dist/assets/*.js | sort -hk5
```

Snapshot atual (build M11, sem chunks acima de 500kb gzip pelo aviso do vite):

- Verificar `dist/assets/index-*.js`, vendor chunks separados:
  - `react-vendor`, `motion-vendor`, `charts-vendor`, `datefns-vendor`,
    `icons-vendor`, `pdf-vendor`.
- Lazy chunks por rota: Dashboard, Plan12WY, AdminDashboard, etc.
- Service worker (`public/sw.js`) faz precache do shell + stale-while-revalidate
  das chamadas REST de leitura.

### 2. Lighthouse CLI

```bash
# Instalacao (uma vez)
npm install -g lighthouse

# Subir build em servidor estatico
npm run build
npx serve -s dist -l 5000 &
SERVE_PID=$!

# Rodar audit
lighthouse http://localhost:5000 \
  --only-categories=performance,pwa,best-practices \
  --output=html --output-path=./docs/lighthouse-report.html \
  --form-factor=mobile --throttling-method=simulate

kill $SERVE_PID
```

Resultados a serem registrados aqui apos primeira execucao real.

### 3. Numero de queries por pagina

Habilitar console.time temporariamente em `useData.ts` (DEV only) ou
inspecionar Network tab filtrando `/rest/v1/`. Baseline esperado:

| Pagina | Queries (esperado) |
|--------|--------------------|
| /login | 0 (apenas auth) |
| / (Dashboard) | 5-7 (profile + habits + cycles + goals + tactics + tasks + task_checkins + badges) |
| /plano | 4-6 (cycle + goals + tactics + tasks + task_checkins + weekly_scores) |
| /habitos | 2 (habits + habit_checkins) |
| /roi | 3 (roi_baselines + roi_results + cycle) |
| /admin | 8 (profiles + programs + turmas + enrollments + cycles + weekly_scores + invites + monitors) |
| /trainer-dashboard | 6 + 1 RPC alerts |
| /graduated-dashboard | 2 RPC + 1 alerts |
| /messages | 1 messages + 1 profiles join + RPC count |
| /notifications | 1 notification_preferences |

### 4. Limites do PRD a validar

- 50 alunos numa turma > Dashboard treinador deve carregar < 3s.
  - Fixture: criar 50 perfis aluno em uma turma de teste.
  - Medir com Network throttling 4G.
  - Aplicar paginacao se nao bater.
- Check-in de habito < 500ms.
  - Em rede normal: insert direto Supabase ~150-300ms.
  - Em offline: enqueue local ~5ms (immediato).
- Auditoria nao deve degradar fluxo (triggers swallowam erros).

## Otimizacoes ja aplicadas

- Vite com `manualChunks` por vendor (react, motion, charts, datefns, icons, pdf).
- Lazy loading de rotas via `React.lazy`.
- Service worker stale-while-revalidate para REST GET.
- Offline queue para acoes write (check-ins, mark-as-read).
- Indices em colunas de filtro (profile_id, aluno_id, user_id, created_at, sent_at).
- RPCs SECURITY DEFINER para reduzir round-trips.

## Backlog de otimizacoes

- [ ] Paginacao em lista de alunos (admin/trainer dashboards) quando > 50.
- [ ] Virtualizacao em ranking se > 200 entradas.
- [ ] Pre-fetch do dashboard quando usuario aceitar convite.
- [ ] Compress de payload audit_log em export_user_data (gzip).
- [ ] Lighthouse CI no pipeline (futuro).

## Smoke test de performance

Script sugerido (manual): logar como aluno, tempo de Network deve mostrar:
- DOMContentLoaded < 1.5s em 4G simulado.
- Tempo total de queries iniciais < 800ms.
- Tempo de toggle de habito < 500ms (com rede) ou < 50ms (offline).

Registrar resultado real apos primeira execucao em ambiente real do dev.
