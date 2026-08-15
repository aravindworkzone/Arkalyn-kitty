import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import ErrorMessage from "./ErrorMessage";
import { cn } from "../../helpers/cn";

/**
 * A labelled cluster of Chips.
 *
 * Two problems, one wrapper. A bare flex-wrap of chips is heard by a screen
 * reader as N unrelated toggle buttons with no idea which question they answer
 * — `role="group"` plus `aria-labelledby` ties them to their visible label. And
 * a 15-category row is 15 tab stops on the way to the Save button, which is why
 * this implements roving tabindex: the cluster is ONE stop, arrows move inside
 * it. That is the listbox/radiogroup keyboard contract, applied to buttons that
 * stay `aria-pressed` toggles.
 *
 * The tab stop follows focus while the user is inside the group, and otherwise
 * parks on the selected chip, so tabbing back in lands where they left off.
 */
interface ChoiceGroupProps {
    label: ReactNode;
    error?: string;
    /** `wrap` is the pill row; `grid` is the payment-type tile grid. */
    layout?: "wrap" | "grid";
    /** Extra classes for the items container — grid columns, mostly. */
    itemsClass?: string;
    className?: string;
    children: ReactNode;
}

export default function ChoiceGroup({
    label,
    error,
    layout = "wrap",
    itemsClass,
    className,
    children,
}: ChoiceGroupProps) {
    const labelId = useId();
    const itemsRef = useRef<HTMLDivElement>(null);

    const items = (): HTMLButtonElement[] => {
        const el = itemsRef.current;
        if (!el) return [];
        return Array.from(el.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
    };

    // No dependency array on purpose: the chips are data-driven and both their
    // count and which one is pressed change on almost every render, so the tab
    // stop has to be recomputed each time. It touches DOM properties rather
    // than state, so there is no render cascade.
    useEffect(() => {
        const list = items();
        if (list.length === 0) return;
        const focused = list.indexOf(document.activeElement as HTMLButtonElement);
        const pressed = list.findIndex((b) => b.getAttribute("aria-pressed") === "true");
        const stop = focused !== -1 ? focused : pressed !== -1 ? pressed : 0;
        list.forEach((b, i) => {
            b.tabIndex = i === stop ? 0 : -1;
        });
    });

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const list = items();
        if (list.length === 0) return;
        const current = list.indexOf(document.activeElement as HTMLButtonElement);
        if (current === -1) return;

        let next: number;
        switch (e.key) {
            case "ArrowRight":
            case "ArrowDown":
                next = (current + 1) % list.length;
                break;
            case "ArrowLeft":
            case "ArrowUp":
                next = (current - 1 + list.length) % list.length;
                break;
            case "Home":
                next = 0;
                break;
            case "End":
                next = list.length - 1;
                break;
            default:
                return;
        }

        e.preventDefault();
        list[next].focus();
    };

    return (
        <div className={className}>
            <span id={labelId} className="mb-1.5 block text-theme-sm font-medium text-fg">
                {label}
            </span>

            <div
                ref={itemsRef}
                role="group"
                aria-labelledby={labelId}
                onKeyDown={onKeyDown}
                className={cn(
                    layout === "wrap" ? "flex flex-wrap gap-2" : "grid gap-2",
                    itemsClass
                )}
            >
                {children}
            </div>

            {error && (
                <div className="mt-2">
                    <ErrorMessage error={error} />
                </div>
            )}
        </div>
    );
}
