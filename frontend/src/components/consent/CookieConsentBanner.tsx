import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import * as CookieConsent from "vanilla-cookieconsent";
import "vanilla-cookieconsent/dist/cookieconsent.css";

import useTheme from "../../hooks/useTheme";
import { cookieConsentConfig } from "./cookieConsentConfig";

/**
 * Boots vanilla-cookieconsent. Mount once, at the root — the library is a
 * singleton that appends its own `#cc-main` element to <body>, so a second
 * instance would be both pointless and (via `window._ccRun`) a no-op.
 *
 * Renders nothing itself. Everything visible is the library's own DOM; the copy
 * and categories live in cookieConsentConfig.ts.
 */
export default function CookieConsentBanner() {
    const { i18n } = useTranslation();
    const { isDark } = useTheme();
    const language = i18n.resolvedLanguage ?? "en";

    // Boot. The empty dependency array is load-bearing: `run()` reads the
    // stored consent and decides whether to show the banner, and re-running it
    // on every render would rebuild the modal underneath the user.
    useEffect(() => {
        void CookieConsent.run({
            ...cookieConsentConfig,
            language: { ...cookieConsentConfig.language, default: language },
        });
        // `language` is deliberately not a dependency — the effect below owns
        // language changes after boot, without tearing the modal down.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Follow the app's language picker. `setLanguage` re-renders the existing
    // modal in place, so a visitor who switches to Tamil with the banner open
    // sees it translate rather than disappear.
    useEffect(() => {
        void CookieConsent.setLanguage(language);
    }, [language]);

    // The library ships its own dark palette behind `.cc--darkmode` on #cc-main,
    // but decides it from `prefers-color-scheme` at build time, not from this
    // app's explicit theme toggle. Drive the class from useTheme so the banner
    // matches the page even when the OS disagrees with the stored choice.
    // `cc:onModalReady` matters as much as `isDark` here: `run()` is async and
    // the preferences modal is generated lazily, so #cc-main does not
    // necessarily exist yet on the first pass.
    useEffect(() => {
        const apply = () => {
            const root = document.getElementById("cc-main");
            if (root) root.classList.toggle("cc--darkmode", isDark);
        };
        apply();
        window.addEventListener("cc:onModalReady", apply);
        return () => window.removeEventListener("cc:onModalReady", apply);
    }, [isDark]);

    return null;
}
