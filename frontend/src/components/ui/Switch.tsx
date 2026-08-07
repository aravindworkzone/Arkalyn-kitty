import { cn } from "../../helpers/cn";

/**
 * On/off switch.
 *
 * The knob is `bg-white` in both themes deliberately — a switch reads as a
 * physical control, and a knob that darkens with the theme loses the contrast
 * against the brand-filled track that makes the on-state obvious. Same reason
 * the form controls pin white/gray-900 rather than using the surface scale.
 */
interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** Required — the switch renders no visible text of its own. */
    ariaLabel: string;
    disabled?: boolean;
    className?: string;
}

export default function Switch({ checked, onChange, ariaLabel, disabled, className }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                "disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-brand-500" : "bg-line-strong",
                className
            )}
        >
            <span
                className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200",
                    checked ? "translate-x-[18px]" : "translate-x-[3px]"
                )}
            />
        </button>
    );
}
