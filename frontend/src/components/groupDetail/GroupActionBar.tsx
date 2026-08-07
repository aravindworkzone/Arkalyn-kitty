import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type ActionTone = "brand" | "success" | "warning" | "neutral";

const toneClass: Record<ActionTone, string> = {
  brand:
    "text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100 " +
    "dark:text-brand-300 dark:bg-brand-500/10 dark:border-brand-500/20 dark:hover:bg-brand-500/20",
  success:
    "text-success-700 bg-success-50 border-success-200 hover:bg-success-100 " +
    "dark:text-success-300 dark:bg-success-500/10 dark:border-success-500/20 dark:hover:bg-success-500/20",
  warning:
    "text-warning-800 bg-warning-50 border-warning-200 hover:bg-warning-100 " +
    "dark:text-warning-300 dark:bg-warning-500/10 dark:border-warning-500/20 dark:hover:bg-warning-500/20",
  neutral: "text-fg-muted bg-surface-raised border-line hover:bg-surface-hover hover:text-fg",
};

interface Props {
  groupId: string | undefined;
  isAdmin: boolean;
  hasRole: boolean;
  /** Adding an expense needs a category — hide the entry until one exists. */
  showAddExpense: boolean;
  navigate: (path: string) => void;
  onOpenSettings: () => void;
}

/**
 * The five primary group actions. Tones are semantic rather than one hue per
 * button — brand for the two "create" paths, neutral for the read-only reports,
 * warning for settings.
 */
export default function GroupActionBar({
  groupId,
  isAdmin,
  hasRole,
  showAddExpense,
  navigate,
  onOpenSettings,
}: Props) {
  const { t } = useTranslation();

  const actions: { label: string; onClick: () => void; tone: ActionTone; icon: ReactNode; show: boolean }[] = [
    {
      label: t("groupDetail.addExpense"),
      onClick: () => navigate(`/groups/${groupId}/expenses/new`),
      tone: "brand",
      icon: <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
      show: showAddExpense,
    },
    {
      label: t("groupDetail.category"),
      onClick: () => navigate(`/groups/${groupId}/categories/new`),
      tone: "brand",
      icon: <path d="M2 4h4v4H2zM8 4h4v4H8zM2 10h4v4H2zM8 10h4v4H8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />,
      show: isAdmin,
    },
    {
      label: t("groupDetail.report"),
      onClick: () => navigate(`/groups/${groupId}/activity`),
      tone: "neutral",
      icon: <path d="M2 12V6l4-4h6l2 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />,
      show: true,
    },
    {
      label: t("groupDetail.breakdown"),
      onClick: () => navigate(`/groups/${groupId}/reports/categories`),
      tone: "neutral",
      icon: (
        <>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7 1.5v5.5l4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </>
      ),
      show: true,
    },
    {
      label: t("groupDetail.settings"),
      onClick: onOpenSettings,
      tone: "warning",
      icon: (
        <>
          <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.6 2.6l1 1M9.4 9.4l1 1M2.6 11.4l1-1M9.4 4.6l1-1"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </>
      ),
      show: hasRole,
    },
  ];

  return (
    <div className={`grid gap-2 grid-cols-3 ${isAdmin ? "sm:grid-cols-5" : ""}`}>
      {actions.filter((a) => a.show).map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          className={`flex flex-col items-center gap-2 py-3.5 rounded-xl border text-theme-xs font-semibold
            transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${toneClass[a.tone]}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            {a.icon}
          </svg>
          {a.label}
        </button>
      ))}
    </div>
  );
}
