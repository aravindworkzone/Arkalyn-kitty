import { useId } from "react";
import type { ReactNode } from "react";
import Label from "./Label";
import { FormFieldContext } from "./formFieldContext";
import { cn } from "../../helpers/cn";

/**
 * The one shared form-field wrapper UI_PROMPT asks for: label above, control,
 * helper/error below, red asterisk when required. Today every call site
 * hand-places its own <ErrorMessage>, so error styling drifts field to field.
 *
 * Controls that consume FormFieldContext (Input, and the phase-4 Select /
 * DatePicker) wire up id, aria-describedby and aria-invalid automatically:
 *
 *   <FormField label="Amount" required error={errors.amount}>
 *     <Input inputMode="decimal" />
 *   </FormField>
 */

interface FormFieldProps {
    label?: ReactNode;
    required?: boolean;
    /** Shown below the control while there is no error. */
    hint?: ReactNode;
    /** Presence switches the field to its invalid state and hides the hint. */
    error?: string;
    className?: string;
    children: ReactNode;
}

export default function FormField({
    label,
    required,
    hint,
    error,
    className,
    children,
}: FormFieldProps) {
    const id = useId();
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    const invalid = Boolean(error);

    // An error replaces the hint rather than stacking with it, so only one of
    // the two is ever announced.
    const describedBy = invalid ? errorId : hint ? hintId : undefined;

    return (
        <div className={cn("w-full", className)}>
            {label !== undefined && (
                <Label htmlFor={id} required={required}>
                    {label}
                </Label>
            )}

            <FormFieldContext.Provider value={{ id, describedBy, invalid }}>
                {children}
            </FormFieldContext.Provider>

            {/* Colours here are contrast-driven, not arbitrary. error-500 as text
                is only 3.76:1 on white and fg-subtle only 2.58:1 — both fail AA
                for text that carries real information. error-600/400 and
                fg-muted clear 4.5:1 in both themes. */}
            {invalid ? (
                <p
                    id={errorId}
                    role="alert"
                    className="mt-1.5 text-theme-xs text-error-600 dark:text-error-400"
                >
                    {error}
                </p>
            ) : hint ? (
                <p id={hintId} className="mt-1.5 text-theme-xs text-fg-muted">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}
