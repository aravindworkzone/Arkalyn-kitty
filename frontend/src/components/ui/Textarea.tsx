import type { ComponentPropsWithRef } from "react";
import { useFormField } from "./formFieldContext";
import { cn } from "../../helpers/cn";

/**
 * Multi-line counterpart to Input, and the missing piece that let notes fields
 * sit inside a FormField: a bare <textarea> ignores FormFieldContext, so the
 * generated <label htmlFor> pointed at nothing and the error was never wired to
 * the control.
 *
 * Same explicit `dark:` colour pairs as Input, for the same reason — inputs are
 * pinned to white/gray-900, which is narrower than the shared surface scale.
 */
interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
    /** Force the invalid style. Inside a FormField the error state is inherited. */
    invalid?: boolean;
}

export default function Textarea({
    invalid,
    className,
    id,
    "aria-describedby": ariaDescribedBy,
    ...rest
}: TextareaProps) {
    const field = useFormField();
    const isInvalid = invalid ?? field?.invalid ?? false;

    return (
        <textarea
            {...rest}
            id={id ?? field?.id}
            aria-describedby={ariaDescribedBy ?? field?.describedBy}
            aria-invalid={isInvalid || undefined}
            className={cn(
                "w-full resize-none rounded-lg border px-4 py-2.5 text-theme-sm shadow-theme-xs transition",
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
