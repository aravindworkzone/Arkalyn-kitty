import type { InputHTMLAttributes } from "react";
import ErrorMessage from "./ErrorMessage";
import { blockDateTyping } from "../../helpers/validators";

interface FieldInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  onClearError?: () => void;
  className: string;
}

export default function FieldInput({
  error,
  onClearError,
  onChange,
  className,
  ...rest
}: FieldInputProps) {
  // Whitespace guarding applies to free-text fields only — never to date/color
  // pickers, where the value has a fixed machine format.
  const isTextField = rest.type !== "date" && rest.type !== "color";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isTextField) {
      // Strip leading whitespace as the user types — a field should never
      // start with a space. Trailing spaces are still allowed mid-typing.
      const stripped = e.target.value.replace(/^\s+/, "");
      if (stripped !== e.target.value) e.target.value = stripped;
    }
    if (error) onClearError?.();
    onChange?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Date fields are picker-only — typing is blocked so an invalid or
    // out-of-range date can't be entered by hand.
    if (rest.type === "date") blockDateTyping(e);
    rest.onKeyDown?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (isTextField) {
      // Trim trailing whitespace once the field loses focus.
      const trimmed = e.target.value.trim();
      if (trimmed !== e.target.value) {
        e.target.value = trimmed;
        onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);
      }
    }
    rest.onBlur?.(e);
  };

  return (
    <div>
      <input
        {...rest}
        className={
          className +
          (error
            ? " !border-red-500/60 focus:!border-red-500/70 focus:!ring-red-500/20"
            : "")
        }
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {error && (
        <div className="mt-1.5">
          <ErrorMessage error={error} />
        </div>
      )}
    </div>
  );
}
