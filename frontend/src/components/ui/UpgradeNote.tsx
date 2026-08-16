import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../../helpers/cn";

/**
 * The one way this app says "this group's plan is the reason you can't do that".
 *
 * Plans are per group, so an upsell is only ever meaningful with a group in
 * hand: the CTA deep-links to /pricing?group=<id> so the checkout opens already
 * pointed at the right group instead of making the user re-pick it. Without a
 * groupId it degrades to the bare plans page rather than rendering a dead link.
 *
 * Two intensities, matching Note's rule that visual weight must agree with the
 * words. `blocked` is for a wall the user has actually hit — the member cap is
 * full, the button is disabled — and gets a tinted panel. `hint` is for a
 * capability they simply don't have yet and gets a quiet line, because a
 * bordered box for "you could also do X" is nagging.
 *
 * Renders nothing when `show` is false, so callers can pass a plan condition
 * straight through without wrapping every use in a guard.
 */
interface UpgradeNoteProps {
    /** Gate — false renders nothing at all. */
    show?: boolean;
    /** What is unavailable and why, in one sentence. */
    children: React.ReactNode;
    /** The group whose plan needs lifting; omit only where none is in scope. */
    groupId?: string;
    variant?: "hint" | "blocked";
    /** Hidden for viewers who can't buy — only admins reach checkout. */
    canUpgrade?: boolean;
    className?: string;
}

export default function UpgradeNote({
    show = true,
    children,
    groupId,
    variant = "hint",
    canUpgrade = true,
    className,
}: UpgradeNoteProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();

    if (!show) return null;

    const blocked = variant === "blocked";

    return (
        <div
            role="status"
            className={cn(
                "flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5",
                blocked
                    ? "rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-theme-xs text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300"
                    : "text-theme-2xs text-fg-muted",
                className
            )}
        >
            <span className="min-w-0 flex-1">{children}</span>
            {canUpgrade && (
                <button
                    type="button"
                    onClick={() => navigate(groupId ? `/pricing?group=${groupId}` : "/pricing")}
                    className={cn(
                        "shrink-0 font-semibold rounded transition-colors",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                        blocked
                            ? "underline underline-offset-2 hover:no-underline"
                            : "text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
                    )}
                >
                    {t("upgrade.cta", "Upgrade this group")}
                </button>
            )}
        </div>
    );
}
