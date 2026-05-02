/**
 * M10 - Push Subscription utilitario
 *
 * IMPORTANTE: Atualmente NAO temos backend para enviar Web Push real (VAPID).
 * Por isso, todas as notificacoes sao disparadas LOCALMENTE no cliente
 * via `registration.showNotification()` (mesmo padrao usado pelo lembrete
 * de habitos em `Shell.tsx`).
 *
 * Este modulo:
 *  - Pede permissao de notificacao quando necessario.
 *  - Faz `pushManager.subscribe()` opcional caso uma `VAPID_PUBLIC_KEY`
 *    seja injetada via `import.meta.env.VITE_VAPID_PUBLIC_KEY` no futuro.
 *  - Persiste a subscription em `push_subscriptions` (tabela ja preparada).
 *  - Expoe `showLocalNotification()` para uso em qualquer hook/pagina.
 */

import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = (import.meta as any)?.env?.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type LocalNotificationPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isPushManagerSupported() {
  return (
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  );
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  return Notification.requestPermission();
}

/**
 * Mostra uma notificacao local via service worker (com fallback Notification).
 * E a forma usada por todas as RFs do M10 (RF60-RF62) na ausencia de backend push.
 */
export async function showLocalNotification(payload: LocalNotificationPayload) {
  if (!isNotificationSupported()) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    tag: payload.tag,
    data: { url: payload.url, ...(payload.data ?? {}) },
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(payload.title, options);
      return true;
    }
  } catch (err) {
    console.warn('showLocalNotification SW falhou, usando fallback', err);
  }

  try {
    new Notification(payload.title, options);
    return true;
  } catch (err) {
    console.warn('showLocalNotification fallback falhou', err);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Tenta registrar push subscription real (somente se VAPID estiver configurado).
 * Caso contrario nao faz nada e retorna null.
 */
export async function subscribePushIfAvailable(userId: string) {
  if (!isPushManagerSupported() || !VAPID_PUBLIC_KEY) {
    return null;
  }

  const permission = await ensureNotificationPermission();
  if (permission !== 'granted') return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const sub = subscription.toJSON() as { endpoint?: string; keys?: Record<string, string> };
    if (!sub.endpoint || !sub.keys) return null;

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          keys: sub.keys,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
        { onConflict: 'user_id,endpoint' },
      );

    if (error) {
      console.warn('subscribePushIfAvailable persist error', error);
    }

    return sub;
  } catch (err) {
    console.warn('subscribePushIfAvailable error', err);
    return null;
  }
}
