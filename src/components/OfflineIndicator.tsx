import React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import {
  flushQueue,
  isOnline as detectOnline,
  subscribe as subscribeQueue,
} from '../lib/offlineQueue';
import type { OfflineQueueOperation } from '../types';

export default function OfflineIndicator() {
  const [online, setOnline] = React.useState<boolean>(() => detectOnline());
  const [queue, setQueue] = React.useState<OfflineQueueOperation[]>([]);
  const [flushing, setFlushing] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  React.useEffect(() => {
    return subscribeQueue((q) => setQueue(q));
  }, []);

  const handleFlush = async () => {
    if (!online) return;
    setFlushing(true);
    try {
      await flushQueue();
    } finally {
      setFlushing(false);
    }
  };

  if (online && queue.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
      style={{
        borderColor: online ? 'rgba(34,197,94,0.3)' : 'rgba(244,63,94,0.4)',
        background: online ? 'rgba(34,197,94,0.08)' : 'rgba(244,63,94,0.08)',
        color: online ? '#22c55e' : '#fb7185',
      }}
      data-testid="offline-indicator"
      title={online ? 'Online com fila pendente' : 'Offline - acoes serao sincronizadas'}
    >
      {online ? (
        <RefreshCw className={`h-3 w-3 ${flushing ? 'animate-spin' : ''}`} />
      ) : (
        <CloudOff className="h-3 w-3" />
      )}
      <span>{online ? 'Sincronizando' : 'Offline'}</span>
      {queue.length > 0 ? (
        <button
          type="button"
          onClick={() => void handleFlush()}
          disabled={!online || flushing}
          className="ml-1 rounded-full bg-black/30 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-white/80 disabled:opacity-50"
        >
          {queue.length} pendente{queue.length === 1 ? '' : 's'}
        </button>
      ) : null}
    </div>
  );
}
