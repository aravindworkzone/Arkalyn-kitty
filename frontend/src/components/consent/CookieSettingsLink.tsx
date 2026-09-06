import { useTranslation } from "react-i18next";
import * as CookieConsent from "vanilla-cookieconsent";

import { cn } from "../../helpers/cn";

interface CookieSettingsLinkProps {
    className?: string;
}

/**
 * Reopens the preferences modal so a visitor can change or withdraw consent
 * later — the "as easy to withdraw as to give" half of GDPR. Belongs anywhere
 * reachable from every page; today that is the landing footer.
 *
 * Styled as a link rather than a Button on purpose: it sits in the footer's
 * fine-print row next to the copyright and the pricing link.
 */
export default function CookieSettingsLink({ className }: CookieSettingsLinkProps) {
    const { t } = useTranslation();

    return (
        <button
            type="button"
            onClick={() => CookieConsent.showPreferences()}
            className={cn("hover:text-fg transition-colors", className)}
        >
            {t("landing.footer.cookieSettings")}
        </button>
    );
}
