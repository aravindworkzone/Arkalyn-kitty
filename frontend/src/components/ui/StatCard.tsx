interface Props {
  label: string;
  value: string | number;
  color?: string;
  currency?: boolean;
}

export default function StatCard({ label, value, color, currency = false }: Props) {
  const display =
    currency && typeof value === "number"
      ? `₹${value.toLocaleString("en-IN")}`
      : value;

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{label}</p>
      <p
        className="text-[16px] font-semibold font-mono text-[#f0eeff]"
        style={color ? { color } : undefined}
      >
        {display}
      </p>
    </div>
  );
}
