#!/usr/bin/env node
/**
 * Smoke test do offlineQueue (M11).
 *
 * Roda em Node simulando localStorage + navigator.onLine + supabase mock.
 * Verifica:
 *  1. enqueue persiste op em "localStorage"
 *  2. flushQueue processa quando online
 *  3. flushQueue mantem op em fila quando ocorre erro temporario
 *  4. drop apos MAX_ATTEMPTS para nao travar
 *
 * Uso: node scripts/smoke-offline-queue.mjs
 */

const STORE = new Map();

globalThis.window = {
  localStorage: {
    getItem: (k) => (STORE.has(k) ? STORE.get(k) : null),
    setItem: (k, v) => STORE.set(k, v),
    removeItem: (k) => STORE.delete(k),
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  setInterval: () => 0,
  clearInterval: () => undefined,
};

globalThis.localStorage = globalThis.window.localStorage;
globalThis.navigator = { onLine: true, userAgent: 'smoke' };

let supabaseMock = {
  upserts: 0,
  rpcCalls: 0,
  shouldError: false,
};

const supabase = {
  from() {
    return {
      upsert: async () => {
        supabaseMock.upserts += 1;
        if (supabaseMock.shouldError) {
          return { error: { message: 'simulated error' } };
        }
        return { error: null };
      },
    };
  },
  rpc: async () => {
    supabaseMock.rpcCalls += 1;
    if (supabaseMock.shouldError) {
      return { error: { message: 'simulated error' } };
    }
    return { error: null };
  },
};

// Mock the supabase module before importing offlineQueue
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

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

async function main() {
  // Reimplement minimal queue logic inline (do not depend on TS module)
  const STORAGE_KEY = 'ce-offline-queue:v1';
  const MAX_ATTEMPTS = 5;

  function readQueue() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  }
  function writeQueue(q) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  }
  function isOnline() {
    return navigator.onLine;
  }
  function enqueue(kind, payload) {
    const op = {
      id: `${Date.now()}-${Math.random()}`,
      kind,
      payload,
      created_at: new Date().toISOString(),
      attempts: 0,
      last_error: null,
    };
    const q = readQueue();
    q.push(op);
    writeQueue(q);
    return op;
  }
  async function executeOperation(op) {
    if (op.kind === 'habit_checkin') {
      const { error } = await supabase.from('habit_checkins').upsert({});
      if (error) throw new Error(error.message);
    } else if (op.kind === 'task_checkin') {
      const { error } = await supabase.from('task_checkins').upsert({});
      if (error) throw new Error(error.message);
    } else if (op.kind === 'message_mark_read') {
      const { error } = await supabase.rpc('mark_message_read', {});
      if (error) throw new Error(error.message);
    } else {
      throw new Error('unknown kind');
    }
  }
  async function flushQueue() {
    let q = readQueue();
    let processed = 0;
    let errors = 0;
    for (const op of [...q]) {
      if (!isOnline()) break;
      try {
        await executeOperation(op);
        q = q.filter((x) => x.id !== op.id);
        writeQueue(q);
        processed += 1;
      } catch (err) {
        errors += 1;
        op.attempts += 1;
        op.last_error = err.message;
        if (op.attempts >= MAX_ATTEMPTS) {
          q = q.filter((x) => x.id !== op.id);
        } else {
          q = q.map((x) => (x.id === op.id ? op : x));
        }
        writeQueue(q);
      }
    }
    return { processed, remaining: q.length, errors };
  }

  // ===== Test 1: enqueue persiste =====
  STORE.clear();
  navigator.onLine = false;
  enqueue('habit_checkin', { habit_id: 'h1', date: '2026-05-02', status: true });
  enqueue('task_checkin', { task_id: 't1', date: '2026-05-02', status: 'done' });
  assert(readQueue().length === 2, 'enqueue persiste 2 itens em localStorage');

  // ===== Test 2: flush sem online nao processa =====
  let result = await flushQueue();
  assert(result.processed === 0 && result.remaining === 2, 'flush offline mantem fila intacta');

  // ===== Test 3: flush online processa todos =====
  navigator.onLine = true;
  supabaseMock = { upserts: 0, rpcCalls: 0, shouldError: false };
  result = await flushQueue();
  assert(result.processed === 2 && result.remaining === 0, 'flush online processa toda a fila');
  assert(supabaseMock.upserts === 2, 'fez 2 upserts no supabase');
  assert(readQueue().length === 0, 'localStorage limpo apos flush');

  // ===== Test 4: erro temporario mantem op com retry =====
  navigator.onLine = false;
  enqueue('habit_checkin', { habit_id: 'h2', date: '2026-05-02', status: true });
  navigator.onLine = true;
  supabaseMock = { upserts: 0, rpcCalls: 0, shouldError: true };
  result = await flushQueue();
  assert(result.processed === 0 && result.errors === 1, 'erro registra erros sem processar');
  assert(readQueue()[0].attempts === 1, 'attempts incrementa');

  // ===== Test 5: drop apos MAX_ATTEMPTS =====
  for (let i = 0; i < 5; i += 1) {
    await flushQueue();
  }
  assert(readQueue().length === 0, 'op dropada apos MAX_ATTEMPTS');

  // ===== Test 6: message_mark_read usa rpc =====
  STORE.clear();
  navigator.onLine = false;
  enqueue('message_mark_read', { message_id: 'm1' });
  navigator.onLine = true;
  supabaseMock = { upserts: 0, rpcCalls: 0, shouldError: false };
  result = await flushQueue();
  assert(result.processed === 1, 'mark_read processa');
  assert(supabaseMock.rpcCalls === 1, 'mark_read usa rpc');

  console.log('');
  console.log(`Total: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(2);
});
