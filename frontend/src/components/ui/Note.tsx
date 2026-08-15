import type { ReactNode } from "react";
import type { Tone } from "../../helpers/tone";
import { toneChip, toneText } from "../../helpers/tone";
import { cn } from "../../helpers/cn";

/**
 * A quiet advisory line — the tier below ErrorMessage.
 *
 * The create-expense form used to render "you are over the category limit" and
 * "you have tagged more than this funder contributed" as full-width bordered
 * cards with a warning triangle, while the copy inside both ended with "you can
 * still save it — this is only a heads-up". The visual weight said blocked and
 * the words said advisory, so the words lost. This is the component for the
 * things that are genuinely only worth a sentence.
 *
 * ErrorMessage stays what it is: the thing that says you cannot submit.
 * Anything that does not stop a submit belongs here instead.
 *
 * Only `error` gets a tinted panel. Every other tone is bare text, because a
 * bordered box is the exact signal we are trying not to send.
 */
interface NoteProps {
    tone?: Tone;
    children: ReactNode;
    /** Trailing control — a "Re-split equally" style one-tap fix. */
    action?: ReactNode;
    /** Off by default; a triangle is most of what made the old cards shout. */
    icon?: boolean;
    /** Announce changes to screen readers. On by default. */
    live?: boolean;
    /** `"no"` keeps machine translation off amounts and user-entered names. */
    translate?: "yes" | "no";
    className?: string;
}

export default function Note({
    tone = "neutral",
    children,
    action,
    icon = false,
    live = true,
    translate,
    className,
}: NoteProps) {
    const panelled = tone === "error";

    return (
        <div
            role={live ? "status" : undefined}
            aria-live={live ? "polite" : undefined}
            translate={translate}
            className={cn(
                "flex items-start gap-1.5 text-theme-2xs",
                panelled && cn("rounded-lg border px-3 py-2", toneChip[tone]),
                !panelled && toneText[tone],
                className
            )}
        >
            {icon && (
                <svg
                    className="w-3 h-3 mt-[3px] shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            )}
            <span className="min-w-0 flex-1">{children}</span>
            {action}
        </div>
    );
}
