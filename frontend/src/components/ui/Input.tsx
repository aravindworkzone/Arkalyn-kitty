import type { ChangeEvent, ComponentPropsWithRef, FocusEvent } from "react";
import { useFormField } from "./formFieldContext";
import { cn } from "../../helpers/cn";

/**
 * Design-system text input (UI_PROMPT .form-input).
 *
 * Carries over the whitespace guarding from the legacy FieldInput — a field
 * should never start with a space, and trailing space is trimmed on blur — so
 * migrating a call site in phase 5 doesn't quietly drop that behaviour. Date
 * handling deliberately does NOT come along; that belongs to the phase-4b
 * DatePicker.
 *
 * Colours here are explicit `dark:` pairs rather than semantic tokens: the doc
 * pins inputs to white/gray-900 backgrounds and gray-800/white-90 text, which
 * is narrower than the shared surface scale. One primitive, one place.
 */

export type InputSize = "sm" | "md";

interface InputProps extends Omit<ComponentPropsWithRef<"input">, "size"> {
    /** Force the invalid style. Inside a FormField the error state is inherited. */
    invalid?: boolean;
    /** Skip the leading-space strip / trim-on-blur (machine-format values). */
    rawValue?: boolean;
    /** `sm` is the compact inline variant — narrow amount fields inside a list
     *  row, where the default 42px control is taller than the row itself. */
    size?: InputSize;
}

const sizeClass: Record<InputSize, string> = {
    sm: "px-2.5 py-1.5 text-theme-xs",
    md: "px-4 py-2.5 text-theme-sm",
};

export default function Input({
    invalid,
    rawValue = false,
    size = "md",
    className,
    onChange,
    onBlur,
    id,
    "aria-describedby": ariaDescribedBy,
    ...rest
}: InputProps) {
    const field = useFormField();
    const isInvalid = invalid ?? field?.invalid ?? false;

    // Machine-format inputs (date, color, number) must not be whitespace-mangled.
    const guarded =
        !rawValue && rest.type !== "date" && rest.type !== "color" && rest.type !== "number";

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (guarded) {
            const stripped = e.target.value.replace(/^\s+/, "");
            if (stripped !== e.target.value) e.target.value = stripped;
        }
        onChange?.(e);
    };

    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
        if (guarded) {
            const trimmed = e.target.value.trim();
            if (trimmed !== e.target.value) {
                e.target.value = trimmed;
                onChange?.(e as unknown as ChangeEvent<HTMLInputElement>);
            }
        }
        onBlur?.(e);
    };

    return (
        <input
            {...rest}
            id={id ?? field?.id}
            aria-describedby={ariaDescribedBy ?? field?.describedBy}
            aria-invalid={isInvalid || undefined}
            onChange={handleChange}
            onBlur={handleBlur}
            className={cn(
                "w-full rounded-lg border shadow-theme-xs transition",
                sizeClass[size],
                "bg-white text-gray-800 placeholder:text-gray-400",
                "dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500",
                "focus:outline-none focus:ring-2",
                isInvalid
                    ? "border-error-500 focus:border-error-500 focus:ring-error-500/10"
                    : "border-gray-300 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700",
                "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
                "dark:disabled:bg-gray-900/50 dark:disabled:text-gray-600",
                className
            )}
        />
    );
}
