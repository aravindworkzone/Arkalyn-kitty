import { ReactNode } from "react";

interface Props {
  step: string;
  title: string;
  children: ReactNode;
  headerRight?: ReactNode;
  contentClass?: string;
}

export default function FormSection({
  step,
  title,
  children,
  headerRight,
  contentClass = "px-5 py-4",
}: Props) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
      <div
        className={`flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] ${
          headerRight ? "justify-between" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-white/15 tabular-nums">{step}</span>
          <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">{title}</span>
        </div>
        {headerRight}
      </div>
      <div className={contentClass}>{children}</div>
    </div>
  );
}
