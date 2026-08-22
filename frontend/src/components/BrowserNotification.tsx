import { useEffect, useRef } from 'react';
import { useSubscribePushMutation } from '../redux/api/user';
import { subscribeUserToPush, pushSupported } from '../utils/browserNotification';

/**
 * Registers this browser for push, once, for a signed-in user.
 *
 * Mounted from AppLayout rather than App: the subscribe call is authenticated,
 * so running it app-wide would fire `POST /user/notificationSubscription` for
 * signed-out visitors on the landing page. That 401 goes through
 * redux/api/base.ts, which reads a rejected refresh as "session dead" and sends
 * the visitor to /login — a permission prompt and an eviction, both for someone
 * who has not signed up yet. AppLayout only renders behind ProtectedRouter, so
 * by the time this mounts there is a session to attach the subscription to.
 */
export default function EnableNotifications() {
  const [subscribePush] = useSubscribePushMutation();
  // StrictMode double-invokes effects in development, and this one both prompts
  // and POSTs. Guarding on a ref keeps it to one attempt per mount.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !pushSupported()) return;
    attempted.current = true;

    const run = async () => {
      try {
        const subscription = await subscribeUserToPush();
        if (!subscription) return;
        // toJSON() is the wire shape the backend validates: endpoint + keys.
        await subscribePush(subscription.toJSON()).unwrap();
      } catch (err) {
        // Push is an enhancement — the socket and the in-app notification list
        // still work without it, so a failure here must stay silent to the user.
        console.warn('Push subscription failed', err);
      }
    };

    void run();
  }, [subscribePush]);

  return null;
}
