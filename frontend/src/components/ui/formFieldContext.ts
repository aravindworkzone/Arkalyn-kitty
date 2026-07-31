import { createContext, useContext } from "react";

/**
 * Lets a control inside <FormField> pick up its id and error wiring without the
 * caller threading them by hand. Kept in its own module so Input (and the
 * phase-4 Select / DatePicker) can consume it without importing FormField,
 * which renders them.
 */
export interface FormFieldA11y {
    /** id for the control; the label's htmlFor points at it. */
    id: string;
    /** ids of the hint and/or error text, for aria-describedby. */
    describedBy?: string;
    invalid: boolean;
}

export const FormFieldContext = createContext<FormFieldA11y | null>(null);

export const useFormField = (): FormFieldA11y | null => useContext(FormFieldContext);
