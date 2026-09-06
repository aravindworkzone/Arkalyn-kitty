import { useEffect, useState } from "react";
import * as CookieConsent from "vanilla-cookieconsent";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

/**
 * The app's only analytics entry point.
 *
 * Nothing here loads on import. Both trackers are behind the same gate — the
 * `analytics` consent category — and the gate is driven entirely by the
 * library's `cc:onConsent` (page load, or first choice) and `cc:onChange`
 * (a later change of mind) events.
 *
 * Two trackers, two mechanisms:
 *   - Google Analytics is injected/removed imperatively, because gtag.js is a
 *     plain <script> in <head>.
 *   - Vercel Web Analytics is a React component, so it is gated by simply not
 *     rendering it — plus an explicit teardown, since @vercel/analytics appends
 *     its script to <head> and does not remove it on unmount.
 */

/** Swap in the real measurement ID. */
export const GA_MEASUREMENT_ID = "G-XXXXXXX";

const GA_SCRIPT_ID = "ga-gtag";

/** Hosts gtag.js pulls in. Used to sweep up on withdrawal. */
const GA_SCRIPT_HOSTS = ["googletagmanager.com", "google-analytics.com"];

/** Both the prod and the dev/debug src @vercel/analytics can inject. */
const VERCEL_SCRIPT_SRCS = ["/_vercel/insights/script", "va.vercel-scripts.com"];

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

// `ga-disable-<ID>` is a dynamic key, so it cannot be declared on Window.
// @vercel/analytics already declares `va` / `vaq` / `vam` for us.
const globals = window as unknown as Record<string, unknown>;

function injectGoogleAnalytics(): void {
    if (document.getElementById(GA_SCRIPT_ID)) return;

    // Clearing the opt-out flag matters on a re-accept: it survives from a
    // previous withdrawal in the same page load and would silently swallow
    // every hit if left set.
    delete globals[`ga-disable-${GA_MEASUREMENT_ID}`];

    window.dataLayer = window.dataLayer ?? [];
    const gtag = (...args: unknown[]) => {
        window.dataLayer?.push(args);
    };
    window.gtag = gtag;

    const script = document.createElement("script");
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });
}

function removeGoogleAnalytics(): void {
    // Order matters. gtag.js cannot truly be unloaded once evaluated, so the
    // opt-out flag goes up *first* — it is Google's supported kill switch and
    // makes any in-flight or queued call a no-op. Removing the tags after that
    // stops anything new from loading.
    globals[`ga-disable-${GA_MEASUREMENT_ID}`] = true;

    document.getElementById(GA_SCRIPT_ID)?.remove();
    for (const script of document.querySelectorAll("script[src]")) {
        const src = script.getAttribute("src") ?? "";
        if (GA_SCRIPT_HOSTS.some((host) => src.includes(host))) script.remove();
    }

    delete window.gtag;
    delete window.dataLayer;

    // Belt and braces alongside the category's `autoClear` — this also covers a
    // withdrawal that happens without a category toggle.
    CookieConsent.eraseCookies([/^_ga/, "_gid", /^_gat/]);
}

function removeVercelAnalytics(): void {
    for (const script of document.querySelectorAll("script[src]")) {
        const src = script.getAttribute("src") ?? "";
        if (VERCEL_SCRIPT_SRCS.some((s) => src.includes(s))) script.remove();
    }
    delete window.va;
    delete window.vaq;
    delete window.vam;
}

export default function Analytics() {
    const [allowed, setAllowed] = useState(false);

    useEffect(() => {
        const sync = () => {
            const accepted = CookieConsent.acceptedCategory("analytics");
            setAllowed(accepted);
            if (accepted) {
                injectGoogleAnalytics();
            } else {
                removeGoogleAnalytics();
                removeVercelAnalytics();
            }
        };

        // `cc:onConsent` fires on every load once a stored choice is read (and
        // on the first choice); `cc:onChange` fires when an existing choice is
        // edited. Both are dispatched on `window`.
        window.addEventListener("cc:onConsent", sync);
        window.addEventListener("cc:onChange", sync);

        // Covers the case where consent resolved before this mounted. Safe to
        // call early: with no stored consent `acceptedCategory` returns false
        // and the teardown path is a no-op.
        sync();

        return () => {
            window.removeEventListener("cc:onConsent", sync);
            window.removeEventListener("cc:onChange", sync);
        };
    }, []);

    return allowed ? <VercelAnalytics /> : null;
}
