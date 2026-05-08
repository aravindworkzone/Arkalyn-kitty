import { useState, useCallback } from "react";

export type FieldErrors<F extends string> = Partial<Record<F, string>>;
export type SetFieldError<F extends string> = (field: F, message: string) => void;
export type ClearFieldError<F extends string> = (field: F) => void;

export function useFieldError<F extends string>() {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<F>>({});

  const setFieldError = useCallback((field: F, message: string) =>
    setFieldErrors((prev) => ({ ...prev, [field]: message })), []);

  const clearFieldError = useCallback((field: F) =>
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    }), []);

  const clearAllFieldErrors = useCallback(() => setFieldErrors({}), []);

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return { fieldErrors, setFieldError, clearFieldError, clearAllFieldErrors, hasFieldErrors };
}
