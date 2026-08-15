import { useTranslation } from "react-i18next";
import { cn } from "../../helpers/cn";

/**
 * Full-width trigger that reveals the sidebar. Replaces GroupActionBar.
 *
 * That component was a 3-or-5 column grid of tiles — Add Expense, Category,
 * Report, Breakdown, Settings — duplicating destinations the sidebar's group
 * view already lists. Two menus of the same actions drift apart, so the tiles
 * are gone and this hands the user to the one that stayed.
 *
 * It renders only when there is something to reveal (`show`): below md that is
 * the drawer, at md+ the collapsed rail. With the sidebar already expanded the
 * actions are on screen, and a button that does nothing is worse than no button.
 */

interface QuickAccessButtonProps {
  onOpenSidebar: () => void;
  show?: boolean;
}

export default function QuickAccessButton({ onOpenSidebar, show = true }: QuickAccessButtonProps) {
  const { t } = useTranslation();

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={onOpenSidebar}
      className={cn(
        "w-full flex items-center gap-3 px-5 py-4 rounded-xl border",
        "text-theme-sm font-semibold text-fg bg-surface-raised border-line",
        "hover:bg-surface-hover active:bg-surface-hover transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      )}
    >
      <span
        className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg
          bg-brand-500 text-on-accent shadow-theme-xs"
        aria-hidden="true"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>

      <span className="flex-1 text-left">{t("quickAccess.title", "Quick Access")}</span>

      {/* Points the way the sidebar comes from. */}
      <svg
        width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
        className="shrink-0 text-fg-muted"
      >
        <path d="M7.5 3l-3 3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
