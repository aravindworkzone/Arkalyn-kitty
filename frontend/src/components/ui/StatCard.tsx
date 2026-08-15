interface Props {
  label: string;
  value: string | number;
  /** Explicit override — used where the value carries a category's own colour. */
  color?: string;
  currency?: boolean;
}

export default function StatCard({ label, value, color, currency = false }: Props) {
  const display =
    currency && typeof value === "number"
      ? `₹${value.toLocaleString("en-IN")}`
      : value;

  return (
    <div className="bg-surface-raised border border-line rounded-xl px-5 py-4 shadow-theme-xs">
      <p className="text-theme-2xs uppercase tracking-widest text-fg-muted mb-1.5">{label}</p>
      <p
        className="text-theme-xl font-semibold font-mono text-fg"
        style={color ? { color } : undefined}
      >
        {display}
      </p>
    </div>
  );
}
