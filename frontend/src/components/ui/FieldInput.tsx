import type { InputHTMLAttributes } from "react";
import ErrorMessage from "./ErrorMessage";

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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) onClearError?.();
    onChange?.(e);
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
      />
      {error && (
        <div className="mt-1.5">
          <ErrorMessage error={error} />
        </div>
      )}
    </div>
  );
}
