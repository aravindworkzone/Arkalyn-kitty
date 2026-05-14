interface SegmentedToggleOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentedToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** "light" for the landing page (carries its own dark: variants), "dark" for the app's fixed-dark theme. */
  variant?: "light" | "dark";
  ariaLabel?: string;
  className?: string;
}

const VARIANTS = {
  light: {
    container: "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900",
    active: "bg-indigo-500 text-white shadow-sm shadow-indigo-500/20",
    inactive:
      "text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100",
  },
  dark: {
    container: "border-white/[0.07] bg-white/[0.04]",
    active: "bg-cyan-500/20 text-cyan-300 shadow-sm",
    inactive: "text-white/45 hover:text-white/75",
  },
} as const;

export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  variant = "dark",
  ariaLabel,
  className = "",
}: SegmentedToggleProps<T>) {
  const styles = VARIANTS[variant];

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 p-1 rounded-xl border shrink-0 ${styles.container} ${className}`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            value === opt.value ? styles.active : styles.inactive
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
