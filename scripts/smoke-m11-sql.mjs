#!/usr/bin/env node
/**
 * Smoke test do SQL m11_gaps_transversais.sql.
 * - Valida que arquivo existe e tem secoes esperadas.
 * - Valida que cada CREATE TABLE / RPC / TRIGGER existe.
 * - Nao executa o SQL (precisa de conexao com Supabase).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(__dirname, '../migrations/m11_gaps_transversais.sql');
const sql = readFileSync(sqlPath, 'utf8');

let pass = 0;
let fail = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`  PASS  ${label}`);
    pass += 1;
  } else {
    console.error(`  FAIL  ${label}`);
    fail += 1;
  }
}

// Tabelas
assert(/CREATE TABLE IF NOT EXISTS audit_log/.test(sql), 'tabela audit_log');
assert(/CREATE TABLE IF NOT EXISTS consent_log/.test(sql), 'tabela consent_log');
assert(/CREATE TABLE IF NOT EXISTS roi_access_log/.test(sql), 'tabela roi_access_log');

// RLS
assert(/ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY/.test(sql), 'RLS audit_log');
assert(/ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY/.test(sql), 'RLS consent_log');
assert(/ALTER TABLE roi_access_log ENABLE ROW LEVEL SECURITY/.test(sql), 'RLS roi_access_log');

// RPCs
const rpcs = [
  'log_audit',
  'log_roi_access',
  'get_roi_access_count_for_user',
  'get_audit_log',
  'register_consent',
  'get_user_consents',
  'export_user_data',
  'delete_user_data',
];
for (const fn of rpcs) {
  assert(
    new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\b`).test(sql),
    `RPC ${fn}`,
  );
}

// Triggers
const triggers = [
  'audit_profiles_change',
  'audit_roi_baselines_change',
  'audit_roi_results_change',
  'audit_coach_notes_change',
  'audit_messages_change',
];
for (const tg of triggers) {
  assert(new RegExp(`CREATE TRIGGER ${tg}`).test(sql), `trigger ${tg}`);
}

// Grants
assert(/GRANT EXECUTE ON FUNCTION public\.log_audit/.test(sql), 'grant log_audit');
assert(/GRANT EXECUTE ON FUNCTION public\.export_user_data/.test(sql), 'grant export_user_data');
assert(/GRANT EXECUTE ON FUNCTION public\.delete_user_data/.test(sql), 'grant delete_user_data');

// Idempotencia
assert(
  /DROP POLICY IF EXISTS audit_log_select_admin/.test(sql),
  'idempotencia: DROP POLICY IF EXISTS',
);
assert(
  /DROP TRIGGER IF EXISTS audit_profiles_change/.test(sql),
  'idempotencia: DROP TRIGGER IF EXISTS',
);

console.log('');
console.log(`Total: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
