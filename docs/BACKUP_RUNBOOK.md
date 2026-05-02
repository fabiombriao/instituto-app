# Backup, Recuperacao e Confiabilidade Operacional

Documentacao base para garantir resiliencia dos dados do Instituto Caminhos do
Exito hospedados no Supabase. Cobre PITR, backup logico, runbook de restauracao,
SLA de recuperacao alvo e tabelas criticas.

## 1. Backup automatico do Supabase (PITR)

O plano gratuito faz **snapshot diario** mantido por 7 dias. Para PITR (Point In
Time Recovery) precisamos do **plano Pro** ou superior:

- **Como ativar**:
  1. Painel Supabase > Project Settings > Add-ons.
  2. Habilitar "Point in Time Recovery".
  3. Escolher janela de retencao (7 ou 28 dias).
  4. Aguardar provisionamento (~10 minutos).

- **Frequencia de backup**:
  - Snapshots diarios (full).
  - WAL streaming continuo (diferenca minimas - 2 segundos).
  - Permite restaurar para qualquer ponto da janela.

- **Custo**:
  - Pro: USD 25/mes + storage adicional.
  - PITR add-on: ~USD 100/mes para 7 dias.

## 2. Backup logico via Edge Function (complementar)

A Edge Function `daily-backup-export` exporta **JSON das tabelas criticas**
para o bucket Storage `backups`. E uma camada extra para:

- Cenarios em que o snapshot Supabase nao esteja disponivel.
- Migrar para outro provedor.
- Auditar consistencia historica.

### Setup

1. Criar bucket privado `backups` (Storage > New bucket).
2. Deploy da function:
   ```bash
   supabase functions deploy daily-backup-export
   ```
3. Configurar secret:
   - `SUPABASE_SERVICE_ROLE_KEY` (auto via Supabase CLI).
4. Agendar via Supabase Cron (Database > Cron Jobs):
   ```sql
   select cron.schedule(
     'daily-backup-export',
     '0 6 * * *',
     $$
       select net.http_post(
         url := 'https://<project-ref>.supabase.co/functions/v1/daily-backup-export',
         headers := jsonb_build_object(
           'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
         )
       );
     $$
   );
   ```
   Obs: o helper `pg_net` precisa estar habilitado.
5. Validar no proximo dia:
   - Acessar Storage > backups e confirmar arquivo `YYYY-MM-DD.json`.

### Tabelas exportadas

Veja `supabase/functions/daily-backup-export/index.ts` lista atual.

## 3. Tabelas criticas

| Tabela | Conteudo | Impacto se perder |
|--------|----------|-------------------|
| profiles | Identidade dos usuarios | Bloqueia login/auth |
| enrollments | Vinculo aluno↔turma↔monitor | Quebra hierarquia toda |
| cycles, goals, tactics, tasks, task_checkins | Plano 12WY | Perde historico do aluno |
| habits, habit_checkins | Streak e consistencia | Perde gameficacao |
| roi_baselines, roi_results | Dados financeiros do aluno | Critico (LGPD + reputacao) |
| weekly_scores | Score semanal calculado | Quebra ranking |
| coach_notes | Notas privadas do treinador | Perde acompanhamento |
| messages | Conversas graduado↔aluno | Quebra suporte |
| audit_log, consent_log, roi_access_log | Conformidade LGPD | Multa LGPD |
| user_invites, turma_invites | Fluxo de onboarding | Quebra signup |

## 4. SLA de recuperacao alvo

| Tipo de incidente | RTO (tempo para restaurar) | RPO (perda max aceitavel) |
|-------------------|----------------------------|---------------------------|
| Corrupcao logica (delete em massa) | 1h via PITR | 2 segundos (PITR) |
| Falha de regiao Supabase | 4h via Storage backup | 24h (snapshot) |
| Provedor offline > 24h | Migrar para projeto novo | 24h (Storage backup) |
| Esquema corrompido por migration | 2h (rollback de migration) | 0 - migration revertida |

## 5. Procedimento de restauracao

### 5.1 PITR (recomendado para incidente recente)

1. Painel Supabase > Project > Backups > Point in time.
2. Selecionar timestamp pre-incidente.
3. Confirmar restore.
4. Aguardar (5-30 min). Ambiente fica indisponivel durante.
5. Validar com smoke tests:
   - Login com usuario admin.
   - Listar profiles, enrollments, cycles ativos.
   - Conferir contagem em audit_log.

### 5.2 Restore via JSON backup (Edge Function)

1. Baixar arquivo `YYYY-MM-DD.json` do bucket `backups`.
2. Para cada tabela em ordem topologica:
   - profiles
   - programs > turmas > enrollments
   - cycles > goals > tactics > tasks > task_checkins
   - habits > habit_checkins
   - roi_baselines > roi_results
   - badges > user_badges
   - messages, coach_notes, notification_log, ...
3. Usar `INSERT ... ON CONFLICT DO NOTHING` para evitar duplicidade quando
   PITR ja restaurou dados parciais.
4. Re-executar functions de calculo (ex: `check_and_unlock_badges`).
5. Validar com smoke tests.

### 5.3 Rollback de migration ruim

1. Identificar migration aplicada antes do problema:
   ```sql
   select * from supabase_migrations.schema_migrations order by version desc;
   ```
2. Caso a alteracao seja DDL pura, escrever migration reversa
   (ex: `DROP COLUMN`, `ALTER ... RESET`).
3. Aplicar via SQL Editor.
4. Documentar a regressao em `@aprendizados.md`.

## 6. Boas praticas

- **Migrations idempotentes**: usar `IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DROP IF EXISTS` (padrao M8/M9/M10/M11).
- **Sem deletes em massa direto**: preferir soft delete (`disabled_at`)
  e RPC `delete_user_data` (que ja audita).
- **Triggers de audit_log**: ja registram UPDATE/DELETE em tabelas sensiveis;
  manter ativos.
- **Testar restore em dev**: 1x por trimestre, baixar JSON e tentar restore
  num projeto temporario.

## 7. Quem responde

- **Owner**: time de produto (Fabio).
- **Notificar**: alunos via banner se downtime > 30min.
- **Pos-mortem**: registrar em `@aprendizados.md` com causa raiz, RTO/RPO real
  e acoes preventivas.
