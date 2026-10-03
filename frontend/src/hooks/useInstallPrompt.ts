import { useSyncExternalStore } from "react";

/**
 * Exposes the browser's "install this app" prompt to React.
 *
 * Chromium fires `beforeinstallprompt` once, early — often before React has
 * mounted anything — so the listener is attached when this module is first
 * imported (main.tsx imports it for exactly that reason) and the event is held
 * in a module-level store, the same shape as useTheme.
 *
 * Safari and Firefox never fire the event; there `canInstall` simply stays
 * false and the install entry point never renders. iOS users install through
 * Share → Add to Home Screen, which the manifest and apple-touch-icon cover.
 */

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e) => {
        // Suppress the browser's own mini-infobar; we offer install from the
        // profile menu instead.
        e.preventDefault();
        deferred = e as BeforeInstallPromptEvent;
        emit();
    });
    window.addEventListener("appinstalled", () => {
        deferred = null;
        emit();
    });
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};
const getSnapshot = () => deferred !== null;
const getServerSnapshot = () => false;

/** A prompt event is single-use: after prompt() it must be dropped either way. */
export async function promptInstall(): Promise<boolean> {
    const event = deferred;
    if (!event) return false;
    deferred = null;
    emit();
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === "accepted";
}

export default function useInstallPrompt() {
    const canInstall = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return { canInstall, promptInstall };
}
