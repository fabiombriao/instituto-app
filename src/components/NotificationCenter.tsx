import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, Loader2, MessageSquare, Sparkles, AlertCircle, Calendar, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { useNotifications } from '../hooks/useData';
import type { NotificationLog, NotificationType } from '../types';

const TYPE_ICONS: Record<NotificationType, React.ComponentType<any>> = {
  HABIT_REMINDER: Sparkles,
  WEEKLY_CLOSURE: Calendar,
  LOW_SCORE_ALERT: AlertCircle,
  BADGE_UNLOCK: Trophy,
  MESSAGE_RECEIVED: MessageSquare,
};

const TYPE_LABELS: Record<NotificationType, string> = {
  HABIT_REMINDER: 'Habito',
  WEEKLY_CLOSURE: 'Fechamento',
  LOW_SCORE_ALERT: 'Alerta',
  BADGE_UNLOCK: 'Conquista',
  MESSAGE_RECEIVED: 'Mensagem',
};

export default function NotificationCenter() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.document.addEventListener('mousedown', handler);
    return () => window.document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNotificationClick = async (notification: NotificationLog) => {
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] text-neutral-400 transition-all hover:border-brand-green/30 hover:text-white"
        aria-label="Notificacoes"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black uppercase tracking-tighter text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 mt-3 w-[340px] max-w-[92vw] origin-top-right rounded-[24px] border border-[#1a1a1a] bg-[#050505] p-3 shadow-2xl shadow-black/60 z-[60]"
          >
            <header className="flex items-center justify-between gap-3 px-2 pb-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Centro</p>
                <p className="text-sm font-black uppercase tracking-tight text-white">Notificacoes</p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-brand-green hover:bg-brand-green/20"
                >
                  <Check className="h-3 w-3" /> Marcar tudo
                </button>
              )}
            </header>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-neutral-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#1a1a1a] bg-black/30 px-4 py-8 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">
                    Sem notificacoes
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const Icon = TYPE_ICONS[notification.type] ?? Bell;
                  const unread = !notification.read_at;
                  const inner = (
                    <div
                      className={cn(
                        'group flex items-start gap-3 rounded-2xl border p-3 text-left transition-all',
                        unread
                          ? 'border-brand-green/30 bg-brand-green/10 hover:border-brand-green/50'
                          : 'border-[#1a1a1a] bg-black/30 hover:border-[#262626]',
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                          unread ? 'brand-gradient text-black' : 'border border-[#1a1a1a] bg-[#0a0a0a] text-neutral-500',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500">
                          {TYPE_LABELS[notification.type] ?? notification.type}
                          {unread ? (
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-green" />
                          ) : null}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-white">{notification.title}</p>
                        {notification.body ? (
                          <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{notification.body}</p>
                        ) : null}
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                          {formatDistanceToNowStrict(new Date(notification.sent_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  );

                  if (notification.url) {
                    return (
                      <Link
                        key={notification.id}
                        to={notification.url}
                        onClick={() => void handleNotificationClick(notification)}
                        className="block"
                      >
                        {inner}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => void handleNotificationClick(notification)}
                      className="block w-full"
                    >
                      {inner}
                    </button>
                  );
                })
              )}
            </div>

            <footer className="mt-2 flex items-center justify-between gap-3 border-t border-[#1a1a1a] pt-2 px-2">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500 hover:text-white"
              >
                Preferencias
              </Link>
              <Link
                to="/messages"
                onClick={() => setOpen(false)}
                className="text-[9px] font-black uppercase tracking-[0.25em] text-brand-green hover:text-white"
              >
                Mensagens
              </Link>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
