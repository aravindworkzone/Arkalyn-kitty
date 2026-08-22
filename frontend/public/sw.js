/* Push service worker.
 *
 * Plain browser JS, served from /public as-is — it is not bundled, so no
 * imports, no TypeScript, and no import.meta.env in here.
 *
 * Its whole job is the case the socket cannot cover: the tab is closed, so
 * there is no app running to show an in-app toast. Everything it renders comes
 * from the push payload; it never calls the API.
 */

const DEFAULT_TITLE = 'Arkalyn Kitty';
const NOTIFICATION_ICON = '/mini-logo.png';
const FALLBACK_URL = '/notifications';

/**
 * A push can legitimately arrive with no body, and `event.data.json()` throws on
 * malformed JSON — either would reject the handler and, because the
 * subscription is userVisibleOnly, cost us a browser-generated "site updated in
 * the background" notice instead of ours.
 */
function readPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

self.addEventListener('push', (event) => {
  const data = readPayload(event);

  event.waitUntil(
    self.registration.showNotification(data.title || DEFAULT_TITLE, {
      body: data.body || 'You have a new notification',
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      // Collapses repeat notifications from the same group rather than stacking
      // one per event; the server sets this per group.
      tag: data.tag,
      // With a tag set, renotify tells the OS to alert again on replacement
      // instead of swapping the banner silently.
      renotify: Boolean(data.tag),
      data: { url: data.url || FALLBACK_URL },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || FALLBACK_URL;

  // Prefer an open tab over a new window: openWindow unconditionally would
  // leave the user with a second copy of the app while the first sits behind
  // it. Only same-origin clients are ours to focus.
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).origin !== self.location.origin) continue;
          if ('focus' in client) {
            // navigate() is not implemented everywhere; focusing is the part
            // that must not be lost if it is missing.
            if ('navigate' in client) client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
