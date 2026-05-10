import FieldInput from "./FieldInput";
import { sanitizeAmount } from "../../helpers/validators";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  max?: number;
  error?: string;
  onClearError?: () => void;
  placeholder?: string;
  size?: "lg" | "md" | "sm";
  inputClassName?: string;
  wrapperClassName?: string;
}

const sizeMap = {
  lg: { symbol: "left-3.5 top-3 text-sm",       pad: "pl-7"  },
  md: { symbol: "left-4 top-[11px] text-sm",    pad: "pl-8"  },
  sm: { symbol: "left-2.5 top-1/2 -translate-y-1/2 text-xs", pad: "pl-6" },
};

export default function AmountInput({
  value,
  onChange,
  max,
  error,
  onClearError,
  placeholder = "0",
  size = "lg",
  inputClassName = "",
  wrapperClassName = "",
}: AmountInputProps) {
  const s = sizeMap[size];
  return (
    <div className={`relative ${wrapperClassName}`}>
      <span className={`absolute ${s.symbol} text-white/30 pointer-events-none z-10`}>₹</span>
      <FieldInput
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(sanitizeAmount(e.target.value, max))}
        error={error}
        onClearError={onClearError}
        placeholder={placeholder}
        className={`${inputClassName} ${s.pad}`}
      />
    </div>
  );
}
