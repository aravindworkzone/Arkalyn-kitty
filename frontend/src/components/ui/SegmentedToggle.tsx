interface SegmentedToggleOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentedToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Two-or-more-way switch.
 *
 * The `variant` prop is gone: it existed to pick between the landing page's
 * stone/indigo palette and the app's fixed-dark one. Both now resolve from the
 * same tokens, so there is one look that follows the theme.
 */
export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 p-1 rounded-xl border shrink-0 border-line bg-surface-raised ${className}`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`px-3 py-1.5 text-theme-xs font-semibold rounded-lg transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
              value === opt.value
                ? "bg-brand-500 text-white shadow-theme-xs"
                : "text-fg-muted hover:text-fg"
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
