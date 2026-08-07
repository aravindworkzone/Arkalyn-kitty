import type { ReactNode } from "react";

/**
 * Screen title block: accent icon chip, eyebrow label, title, description.
 *
 * The accent vocabulary is semantic (brand/success/warning/error), not literal
 * hues — the old cyan/violet/indigo/emerald names encoded a palette that no
 * longer exists.
 */
type Accent = "brand" | "success" | "warning" | "error";

interface Props {
  icon: ReactNode;
  accent?: Accent;
  label: string;
  title: string;
  description: string;
}

const accentMap: Record<Accent, { chip: string; label: string }> = {
  brand: {
    chip: "bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-500/15 dark:border-brand-500/25 dark:text-brand-400",
    label: "text-brand-600 dark:text-brand-400",
  },
  success: {
    chip: "bg-success-50 border-success-200 text-success-700 dark:bg-success-500/15 dark:border-success-500/25 dark:text-success-400",
    label: "text-success-700 dark:text-success-400",
  },
  warning: {
    chip: "bg-warning-50 border-warning-200 text-warning-700 dark:bg-warning-500/15 dark:border-warning-500/25 dark:text-warning-400",
    label: "text-warning-700 dark:text-warning-400",
  },
  error: {
    chip: "bg-error-50 border-error-200 text-error-700 dark:bg-error-500/15 dark:border-error-500/25 dark:text-error-400",
    label: "text-error-700 dark:text-error-400",
  },
};

export default function PageHeader({ icon, accent = "brand", label, title, description }: Props) {
  const a = accentMap[accent];
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${a.chip}`}>
          {icon}
        </div>
        <p className={`text-theme-2xs font-semibold uppercase tracking-widest ${a.label}`}>{label}</p>
      </div>
      <h1 className="text-title-sm font-semibold tracking-tight text-fg">{title}</h1>
      <p className="text-theme-sm text-fg-muted mt-1.5">{description}</p>
    </div>
  );
}
