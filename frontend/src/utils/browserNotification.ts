/**
 * Turns the VAPID public key into the byte array `pushManager.subscribe()`
 * wants. The key ships as URL-safe base64 (the `-`/`_` alphabet), which
 * `atob` does not accept, and the padding the encoder strips has to go back on.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  // Backed by an explicit ArrayBuffer: since TS 5.7 Uint8Array is generic over
  // its buffer, and the bare form widens to ArrayBufferLike — which includes
  // SharedArrayBuffer and so does not satisfy BufferSource on subscribe().
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Everything push needs, absent on older Safari and in some embedded webviews. */
export const pushSupported = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * Whether asking is still worth doing. Once a user has answered, the browser
 * remembers: re-requesting a denied permission resolves to 'denied' without
 * ever showing a prompt, so treating it as "ask again later" would just spin.
 */
export const canPromptForPush = (): boolean =>
  pushSupported() && Notification.permission === 'default';

export async function subscribeUserToPush(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn('VITE_VAPID_PUBLIC_KEY is not set — skipping push subscription');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;

  // Reuse before asking. A browser returns the same subscription for the life of
  // the install, so re-subscribing every load would be pure churn — and calling
  // requestPermission() when the answer is already known is what gets a site
  // marked as abusive by the heuristics that auto-block prompts.
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  if (Notification.permission === 'denied') return null;

  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();

  if (permission !== 'granted') return null;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
}
