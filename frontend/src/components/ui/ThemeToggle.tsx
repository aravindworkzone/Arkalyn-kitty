import { useTranslation } from "react-i18next";
import useTheme from "../../hooks/useTheme";
import { cn } from "../../helpers/cn";

/**
 * Light/dark switch for the header.
 *
 * GATING — read before making this unconditional. Most screens are still
 * hardcoded dark (`bg-[#080c14]`, `text-white/45`), so switching to light today
 * produces white-on-white content. Shipping a control that visibly breaks the
 * app is worse than not shipping it yet, so it renders in dev only. Phase 6
 * flips ENABLED to `true` once phase 5 has migrated the screens.
 */
const ENABLED = import.meta.env.DEV;

interface ThemeToggleProps {
    className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
    const { isDark, toggle } = useTheme();
    const { t } = useTranslation();

    if (!ENABLED) return null;

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={
                isDark
                    ? t("nav.themeLight", "Switch to light theme")
                    : t("nav.themeDark", "Switch to dark theme")
            }
            aria-pressed={isDark}
            className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-150",
                "border-line bg-surface-hover text-fg-muted",
                "hover:text-fg active:scale-[0.95]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                className
            )}
        >
            {isDark ? (
                // Sun — clicking returns to light.
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.3" />
                    <path
                        d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13M12.95 12.95l-1.13-1.13M4.18 4.18L3.05 3.05"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                    />
                </svg>
            ) : (
                // Moon — clicking goes to dark.
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                        d="M13.5 9.7A5.8 5.8 0 0 1 6.3 2.5a5.8 5.8 0 1 0 7.2 7.2z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
        </button>
    );
}
