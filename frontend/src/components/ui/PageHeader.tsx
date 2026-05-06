import { ReactNode } from "react";

type AccentColor = "cyan" | "violet" | "indigo";

interface Props {
  icon: ReactNode;
  color?: AccentColor;
  label: string;
  title: string;
  description: string;
}

const colorMap: Record<AccentColor, { iconBg: string; iconBorder: string; labelText: string }> = {
  cyan:   { iconBg: "bg-cyan-500/15",   iconBorder: "border-cyan-500/25",   labelText: "text-cyan-400/70"   },
  violet: { iconBg: "bg-violet-500/15", iconBorder: "border-violet-500/25", labelText: "text-violet-400/70" },
  indigo: { iconBg: "bg-indigo-500/15", iconBorder: "border-indigo-500/25", labelText: "text-indigo-400/70" },
};

export default function PageHeader({ icon, color = "cyan", label, title, description }: Props) {
  const c = colorMap[color];
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg ${c.iconBg} border ${c.iconBorder} flex items-center justify-center`}>
          {icon}
        </div>
        <p className={`text-[10px] font-semibold uppercase tracking-widest ${c.labelText}`}>{label}</p>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-[#f0eeff]">{title}</h1>
      <p className="text-white/35 text-sm mt-1.5">{description}</p>
    </div>
  );
}
