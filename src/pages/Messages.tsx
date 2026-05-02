import React from 'react';
import { Loader2, MessageSquare, Send, Users } from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { useMessageRecipients, useMessages } from '../hooks/useData';
import { showLocalNotification } from '../lib/pushSubscription';
import type { Message } from '../types';
import { cn } from '../lib/utils';

export default function MessagesPage() {
  const { user, profile } = useAuth();
  const { messages, loading, sendMessage, markRead, fetchMessages, unreadCount } = useMessages();
  const { recipients, loading: recipientsLoading } = useMessageRecipients();
  const [selectedPartnerId, setSelectedPartnerId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lastSeenRef = React.useRef<Set<string>>(new Set());

  // Auto-select first recipient
  React.useEffect(() => {
    if (!selectedPartnerId && recipients.length > 0) {
      setSelectedPartnerId(recipients[0].id);
    }
  }, [recipients, selectedPartnerId]);

  // Mostrar notificacao local quando chegarem novas mensagens enquanto a pagina ja estava aberta
  React.useEffect(() => {
    if (!user) return;
    const newIncoming = messages.filter(
      (m) => m.recipient_id === user.id && !lastSeenRef.current.has(m.id),
    );
    const isFirst = lastSeenRef.current.size === 0;
    messages.forEach((m) => lastSeenRef.current.add(m.id));
    if (isFirst) return;

    newIncoming.forEach((m) => {
      void showLocalNotification({
        title: `Mensagem de ${m.sender_name ?? 'contato'}`,
        body: m.content.slice(0, 140),
        url: '/messages',
        tag: `message-${m.id}`,
      });
    });
  }, [messages, user]);

  const partnersFromMessages = React.useMemo(() => {
    if (!user) return [] as { id: string; full_name: string; role?: string }[];
    const map = new Map<string, { id: string; full_name: string; role?: string }>();
    for (const m of messages) {
      const partnerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      const partnerName = m.sender_id === user.id ? m.recipient_name ?? 'Contato' : m.sender_name ?? 'Contato';
      if (!map.has(partnerId)) {
        map.set(partnerId, { id: partnerId, full_name: partnerName });
      }
    }
    return Array.from(map.values());
  }, [messages, user]);

  const partners = React.useMemo(() => {
    const merged = new Map<string, { id: string; full_name: string; role?: string }>();
    for (const r of recipients) merged.set(r.id, r);
    for (const p of partnersFromMessages) {
      if (!merged.has(p.id)) merged.set(p.id, p);
    }
    return Array.from(merged.values());
  }, [recipients, partnersFromMessages]);

  const conversation: Message[] = React.useMemo(() => {
    if (!user || !selectedPartnerId) return [];
    return messages
      .filter(
        (m) =>
          (m.sender_id === user.id && m.recipient_id === selectedPartnerId) ||
          (m.recipient_id === user.id && m.sender_id === selectedPartnerId),
      )
      .slice()
      .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
  }, [messages, user, selectedPartnerId]);

  // Marcar mensagens da conversa selecionada como lidas
  React.useEffect(() => {
    if (!user || !selectedPartnerId) return;
    const unread = conversation.filter((m) => m.recipient_id === user.id && !m.read_at);
    if (unread.length === 0) return;
    void Promise.all(unread.map((m) => markRead(m.id)));
  }, [conversation, user, selectedPartnerId]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPartnerId) {
      setError('Selecione um contato.');
      return;
    }
    const content = draft.trim();
    if (!content) {
      setError('Mensagem nao pode ser vazia.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const result = await sendMessage(selectedPartnerId, content);
      if ((result as any)?.error) {
        setError((result as any).error?.message ?? 'Erro ao enviar mensagem.');
      } else {
        setDraft('');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const canMessage = profile?.role === 'ALUNO_GRADUADO' || profile?.role === 'ALUNO';

  if (!canMessage) {
    return (
      <div className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-8 text-neutral-500">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">Acesso restrito</p>
        <h1 className="mt-2 text-3xl font-black italic uppercase tracking-tighter text-white">
          Mensagens disponiveis para alunos e graduados
        </h1>
        <p className="mt-3 text-sm text-neutral-500">
          Treinadores e admin gerenciam atraves do painel proprio. Acesse pelo seu perfil correspondente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 font-sans text-white">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-green">M10 - RF61/RF62</p>
        <h1 className="mt-3 text-5xl font-black italic uppercase leading-none tracking-tighter md:text-6xl">
          Mensagens
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-neutral-500">
          Canal direto entre o aluno e o monitor graduado. {unreadCount > 0 ? `${unreadCount} mensagem(ns) por ler.` : 'Tudo em dia.'}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-4">
          <header className="mb-3 flex items-center gap-2 px-2 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">
            <Users className="h-4 w-4" /> Contatos
          </header>
          {recipientsLoading && partners.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-neutral-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : partners.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#1a1a1a] bg-black/30 p-4 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              Nenhum contato vinculado.
            </div>
          ) : (
            <ul className="space-y-2">
              {partners.map((partner) => {
                const lastMessage = [...messages]
                  .filter(
                    (m) =>
                      user &&
                      ((m.sender_id === user.id && m.recipient_id === partner.id) ||
                        (m.recipient_id === user.id && m.sender_id === partner.id)),
                  )
                  .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];
                const unread = user
                  ? messages.filter(
                      (m) => m.sender_id === partner.id && m.recipient_id === user.id && !m.read_at,
                    ).length
                  : 0;
                const active = selectedPartnerId === partner.id;
                return (
                  <li key={partner.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedPartnerId(partner.id)}
                      className={cn(
                        'w-full rounded-2xl border p-3 text-left transition-all',
                        active
                          ? 'border-brand-green/50 bg-brand-green/10'
                          : 'border-[#1a1a1a] bg-black/30 hover:border-[#262626]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-black uppercase tracking-tight text-white">
                          {partner.full_name}
                        </p>
                        {unread > 0 && (
                          <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black uppercase text-white">
                            {unread}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                        {lastMessage?.content ?? 'Sem mensagens ainda'}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="flex h-[60vh] flex-col rounded-[28px] border border-[#1a1a1a] bg-[#050505]">
          <header className="flex items-center justify-between gap-3 border-b border-[#1a1a1a] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-green/30 bg-brand-green/10 text-brand-green">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500">Conversa</p>
                <p className="text-sm font-black uppercase tracking-tight text-white">
                  {partners.find((p) => p.id === selectedPartnerId)?.full_name ?? 'Selecione um contato'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void fetchMessages()}
              className="rounded-full border border-[#1a1a1a] bg-black/40 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 hover:text-white"
            >
              Atualizar
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {loading && conversation.length === 0 ? (
              <div className="flex h-full items-center justify-center text-neutral-500">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : conversation.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Nenhuma mensagem ainda. Comece a conversa.
              </div>
            ) : (
              conversation.map((m) => {
                const mine = user && m.sender_id === user.id;
                return (
                  <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-md',
                        mine
                          ? 'bg-brand-green text-black'
                          : 'border border-[#1a1a1a] bg-[#0a0a0a] text-white',
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      <p
                        className={cn(
                          'mt-2 text-[9px] font-black uppercase tracking-[0.25em]',
                          mine ? 'text-black/70' : 'text-neutral-500',
                        )}
                      >
                        {format(new Date(m.sent_at), "dd/MM HH:mm", { locale: ptBR })} -{' '}
                        {formatDistanceToNowStrict(new Date(m.sent_at), { locale: ptBR, addSuffix: true })}
                        {mine && m.read_at ? ' - lida' : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSend} className="border-t border-[#1a1a1a] bg-[#050505] p-4">
            {error ? (
              <p className="mb-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">
                {error}
              </p>
            ) : null}
            <div className="flex items-end gap-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escreva uma mensagem..."
                rows={2}
                disabled={!selectedPartnerId || sending}
                className="flex-1 resize-none rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 text-sm text-white outline-none focus:border-brand-green disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!selectedPartnerId || sending}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-green px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98] disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
