import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "../../helpers/cn";

/** Design-system field label (UI_PROMPT .form-label). */

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
    /** Renders the required asterisk. Mark the control `required` too — this is
     *  presentation only. */
    required?: boolean;
    children: ReactNode;
}

export default function Label({ required, className, children, ...rest }: LabelProps) {
    return (
        <label {...rest} className={cn("mb-1.5 block text-theme-sm font-medium text-fg", className)}>
            {children}
            {required && (
                <span className="ml-0.5 text-error-600 dark:text-error-400" aria-hidden="true">
                    *
                </span>
            )}
        </label>
    );
}
