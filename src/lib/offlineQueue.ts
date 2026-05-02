/**
 * M11 - Offline Queue
 * --------------------------------------------------
 * Persistencia em localStorage de operacoes feitas em modo offline.
 * Quando volta online, processa em ordem de chegada.
 *
 * Operacoes suportadas:
 *  - habit_checkin: { habit_id, date, status }
 *  - task_checkin: { task_id, date, status }
 *  - message_mark_read: { message_id }
 *
 * Decisao: localStorage em vez de IndexedDB pelo volume baixo (decenas de itens)
 * e API sincrona simples. Facil migrar para idb-keyval se precisar.
 */

import { supabase } from './supabase';
import type { OfflineQueueOperation, OfflineQueueOperationKind } from '../types';

const STORAGE_KEY = 'ce-offline-queue:v1';
const MAX_ATTEMPTS = 5;

export type QueueListener = (queue: OfflineQueueOperation[]) => void;

const listeners = new Set<QueueListener>();
let flushing = false;

function readQueue(): OfflineQueueOperation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineQueueOperation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('offlineQueue: parse error, resetting', err);
    return [];
  }
}

function writeQueue(queue: OfflineQueueOperation[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('offlineQueue: write error', err);
  }
  notify(queue);
}

function notify(queue: OfflineQueueOperation[]): void {
  for (const listener of listeners) {
    try {
      listener(queue);
    } catch (err) {
      console.warn('offlineQueue listener error', err);
    }
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return Boolean(navigator.onLine);
}

export function getQueue(): OfflineQueueOperation[] {
  return readQueue();
}

export function getQueueSize(): number {
  return readQueue().length;
}

export function subscribe(listener: QueueListener): () => void {
  listeners.add(listener);
  // emit current state
  listener(readQueue());
  return () => {
    listeners.delete(listener);
  };
}

export function enqueue(
  kind: OfflineQueueOperationKind,
  payload: Record<string, unknown>,
): OfflineQueueOperation {
  const op: OfflineQueueOperation = {
    id: generateId(),
    kind,
    payload,
    created_at: new Date().toISOString(),
    attempts: 0,
    last_error: null,
  };
  const queue = readQueue();
  queue.push(op);
  writeQueue(queue);
  return op;
}

export function clearQueue(): void {
  writeQueue([]);
}

async function executeOperation(op: OfflineQueueOperation): Promise<void> {
  switch (op.kind) {
    case 'habit_checkin': {
      const { habit_id, date, status } = op.payload as {
        habit_id: string;
        date: string;
        status: boolean;
      };
      const { error } = await supabase
        .from('habit_checkins')
        .upsert({ habit_id, date, status }, { onConflict: 'habit_id,date' });
      if (error) throw error;
      return;
    }
    case 'task_checkin': {
      const { task_id, date, status } = op.payload as {
        task_id: string;
        date: string;
        status: 'done' | 'not_done' | string;
      };
      const { error } = await supabase
        .from('task_checkins')
        .upsert({ task_id, date, status }, { onConflict: 'task_id,date' });
      if (error) throw error;
      return;
    }
    case 'message_mark_read': {
      const { message_id } = op.payload as { message_id: string };
      const { error } = await supabase.rpc('mark_message_read', {
        p_message_id: message_id,
      });
      if (error) throw error;
      return;
    }
    default:
      throw new Error(`Operacao offline desconhecida: ${(op as OfflineQueueOperation).kind}`);
  }
}

export async function flushQueue(): Promise<{
  processed: number;
  remaining: number;
  errors: number;
}> {
  if (flushing) {
    return { processed: 0, remaining: readQueue().length, errors: 0 };
  }
  flushing = true;
  let processed = 0;
  let errors = 0;
  try {
    let queue = readQueue();
    if (queue.length === 0) {
      return { processed: 0, remaining: 0, errors: 0 };
    }

    for (const op of [...queue]) {
      if (!isOnline()) break;
      try {
        await executeOperation(op);
        queue = queue.filter((q) => q.id !== op.id);
        writeQueue(queue);
        processed += 1;
      } catch (err: any) {
        errors += 1;
        op.attempts += 1;
        op.last_error = err?.message ?? String(err);
        if (op.attempts >= MAX_ATTEMPTS) {
          // Drop after MAX_ATTEMPTS para nao travar a fila
          queue = queue.filter((q) => q.id !== op.id);
          console.warn(
            `offlineQueue: dropped op ${op.id} after ${MAX_ATTEMPTS} attempts`,
            op.last_error,
          );
        } else {
          queue = queue.map((q) => (q.id === op.id ? op : q));
        }
        writeQueue(queue);
      }
    }

    return { processed, remaining: queue.length, errors };
  } finally {
    flushing = false;
  }
}

let started = false;

export function startOfflineSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const handleOnline = () => {
    void flushQueue();
  };

  window.addEventListener('online', handleOnline);

  // Periodic retry while online (a cada 30s pega itens com erro temporario)
  window.setInterval(() => {
    if (isOnline() && readQueue().length > 0) {
      void flushQueue();
    }
  }, 30_000);

  // Tentar processar se ja estiver online ao iniciar
  if (isOnline() && readQueue().length > 0) {
    void flushQueue();
  }
}
