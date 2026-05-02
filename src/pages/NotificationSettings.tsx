import React from 'react';
import { Bell, Loader2, Mail, Save, Smartphone } from 'lucide-react';
import { useNotificationPreferences } from '../hooks/useData';
import { NOTIFICATION_TYPE_LABELS, NotificationType } from '../types';
import { ensureNotificationPermission, isNotificationSupported } from '../lib/pushSubscription';

const TYPE_DESCRIPTIONS: Record<NotificationType, string> = {
  HABIT_REMINDER: 'Lembrete diario para fazer check-in dos habitos.',
  WEEKLY_CLOSURE: 'Aviso no dia do fechamento semanal da turma.',
  LOW_SCORE_ALERT: 'Quando seu score cai abaixo de 60% por mais de uma semana.',
  BADGE_UNLOCK: 'Celebracao quando uma nova badge e desbloqueada.',
  MESSAGE_RECEIVED: 'Quando voce recebe uma mensagem do graduado ou aluno.',
};

type Channel = 'push' | 'email' | 'in_app';

type DraftMap = Record<NotificationType, { push: boolean; email: boolean; in_app: boolean }>;

function buildDraft(getPreference: (type: NotificationType) => any): DraftMap {
  const types: NotificationType[] = [
    'HABIT_REMINDER',
    'WEEKLY_CLOSURE',
    'LOW_SCORE_ALERT',
    'BADGE_UNLOCK',
    'MESSAGE_RECEIVED',
  ];
  const draft = {} as DraftMap;
  for (const t of types) {
    const pref = getPreference(t);
    draft[t] = {
      push: pref ? Boolean(pref.push_enabled) : true,
      email: pref ? Boolean(pref.email_enabled) : false,
      in_app: pref ? Boolean(pref.in_app_enabled) : true,
    };
  }
  return draft;
}

export default function NotificationSettings() {
  const { preferences, types, getPreference, upsertPreference, loading } = useNotificationPreferences();
  const [draft, setDraft] = React.useState<DraftMap | null>(null);
  const [savingType, setSavingType] = React.useState<NotificationType | null>(null);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const [permission, setPermission] = React.useState<NotificationPermission | 'unsupported'>(
    isNotificationSupported() ? Notification.permission : 'unsupported',
  );

  React.useEffect(() => {
    if (!loading) {
      setDraft(buildDraft(getPreference));
    }
  }, [loading, preferences]);

  const updateDraft = (type: NotificationType, channel: Channel, value: boolean) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [type]: {
          ...current[type],
          [channel]: value,
        },
      };
    });
  };

  const requestPermission = async () => {
    const result = await ensureNotificationPermission();
    setPermission(result);
    setStatusMsg(
      result === 'granted'
        ? 'Permissao concedida. Notificacoes locais ativas.'
        : result === 'denied'
          ? 'Permissao negada pelo navegador.'
          : 'Permissao ainda pendente.',
    );
  };

  const handleSave = async (type: NotificationType) => {
    if (!draft) return;
    setSavingType(type);
    setStatusMsg(null);
    try {
      const entry = draft[type];
      const result = await upsertPreference(type, entry.push, entry.email, entry.in_app);
      if (result && (result as any).message) {
        setStatusMsg(`Erro: ${(result as any).message}`);
      } else {
        setStatusMsg(`Preferencia salva: ${NOTIFICATION_TYPE_LABELS[type]}`);
      }
    } finally {
      setSavingType(null);
    }
  };

  if (loading || !draft) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-neutral-500">
        <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Carregando preferencias</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12 font-sans text-white">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-green">
          M10 - RF63
        </p>
        <h1 className="mt-3 text-5xl font-black italic uppercase leading-none tracking-tighter md:text-6xl">
          Preferencias de notificacao
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-neutral-500">
          Escolha em quais canais voce quer receber cada tipo de aviso. As notificacoes
          push sao disparadas localmente pelo PWA. E-mail fica reservado para quando o
          back-end enviar lembretes de fora do app.
        </p>
      </header>

      <section className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              Permissao do navegador
            </p>
            <p className="mt-2 text-2xl font-black italic uppercase tracking-tighter">
              {permission === 'granted' ? 'Concedida' : permission === 'denied' ? 'Negada' : permission === 'unsupported' ? 'Sem suporte' : 'Pendente'}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Sem permissao concedida o app nao consegue mostrar notificacoes locais.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void requestPermission()}
            disabled={permission === 'granted' || permission === 'denied' || permission === 'unsupported'}
            className="inline-flex items-center gap-2 rounded-2xl border border-brand-green/30 bg-brand-green/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green disabled:opacity-50"
          >
            <Bell className="h-4 w-4" /> Pedir permissao
          </button>
        </div>
      </section>

      {statusMsg ? (
        <div className="rounded-2xl border border-brand-green/20 bg-brand-green/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-brand-green">
          {statusMsg}
        </div>
      ) : null}

      <section className="space-y-4">
        {types.map((type) => {
          const entry = draft[type];
          return (
            <div key={type} className="rounded-[28px] border border-[#1a1a1a] bg-[#050505] p-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-green">
                    {NOTIFICATION_TYPE_LABELS[type]}
                  </p>
                  <p className="mt-2 max-w-xl text-xs text-neutral-500">{TYPE_DESCRIPTIONS[type]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSave(type)}
                  disabled={savingType === type}
                  className="inline-flex items-center gap-2 rounded-2xl border border-brand-green/30 bg-brand-green/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-brand-green disabled:opacity-50"
                >
                  {savingType === type ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
                </button>
              </header>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <ToggleRow
                  icon={<Bell className="h-4 w-4" />}
                  label="Notificacao no app (Bell)"
                  hint="Aparece no centro de notificacoes."
                  checked={entry.in_app}
                  onChange={(v) => updateDraft(type, 'in_app', v)}
                />
                <ToggleRow
                  icon={<Smartphone className="h-4 w-4" />}
                  label="Push do dispositivo"
                  hint="Notificacao local enviada pelo PWA."
                  checked={entry.push}
                  onChange={(v) => updateDraft(type, 'push', v)}
                />
                <ToggleRow
                  icon={<Mail className="h-4 w-4" />}
                  label="E-mail"
                  hint="Reservado para envio externo (futuro)."
                  checked={entry.email}
                  onChange={(v) => updateDraft(type, 'email', v)}
                />
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-4 cursor-pointer">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-[#1a1a1a] bg-[#050505] text-neutral-400">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{label}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-neutral-500">{hint}</p>
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded border-[#1f1f1f] bg-[#050505] text-brand-green focus:ring-brand-green"
      />
    </label>
  );
}
