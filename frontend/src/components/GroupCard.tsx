import MemberAvatars from "./ListMember";
import type { GroupCardProps } from "../interface/group";
import { useTranslation } from "react-i18next";
import { usePlan } from "../hooks/usePlan";
import RoleBadge from "../components/ui/RoleBadge"

const GroupCard = ({ group, onClick, onAddExpense, onToggleFavorite, isTogglingFavorite }: GroupCardProps) => {
  const { t } = useTranslation();
  const { tier } = usePlan();
  const isClosed = group.status === "CLOSED";
  const isFavorite = !!group.isFavorite;
  // Closed groups badge their FROZEN tier (captured at close, immutable) so the
  // historical plan shows even after the owner downgrades. Open groups badge the
  // viewer's own live paid tier on groups they own.
  const badgeTier = isClosed ? group.planSnapshot?.tier : group.role === "SUPER_ADMIN" ? tier : undefined;
  const showPlanBadge = !!badgeTier && badgeTier !== "FREE";

  // Pool health, coarse: comfortable / getting low / nearly spent.
  const barTone =
    group.barLength > 60 ? "bg-brand-500" : group.barLength > 30 ? "bg-warning-500" : "bg-error-500";

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={t("groupCard.openGroup", "Open group: {{name}}", { name: group.name })}
      className={`bg-surface-raised border rounded-2xl p-5 sm:p-6 cursor-pointer shadow-theme-xs transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
        isClosed
          ? "border-warning-300 dark:border-warning-500/20 hover:bg-surface-hover hover:border-warning-400 dark:hover:border-warning-500/30"
          : "border-line hover:bg-surface-hover hover:border-line-strong"
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-theme-sm font-semibold leading-tight truncate ${isClosed ? "text-fg-muted" : "text-fg"}`} translate="no">
              {group.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isTogglingFavorite) onToggleFavorite();
              }}
              disabled={isTogglingFavorite}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? t("groupCard.unfavorite", "Remove favorite") : t("groupCard.favorite", "Mark favorite")}
              title={isFavorite ? t("groupCard.unfavorite", "Remove favorite") : t("groupCard.favorite", "Mark favorite")}
              className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md transition-all duration-150 ${
                isFavorite
                  ? "text-warning-500 hover:bg-warning-500/15 active:bg-warning-500/15"
                  : "text-fg-muted hover:text-fg hover:bg-surface-hover active:text-fg active:bg-surface-hover"
              } ${isTogglingFavorite ? "opacity-50 cursor-wait" : ""}`}
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill={isFavorite ? "currentColor" : "none"} aria-hidden="true">
                <path
                  d="M7 1.5l1.7 3.45L12.5 5.5l-2.75 2.68.65 3.78L7 10.17l-3.4 1.79.65-3.78L1.5 5.5l3.8-.55L7 1.5z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-theme-2xs font-mono px-2 py-0.5 rounded-md border border-line bg-surface-hover text-fg-muted" translate="no">
              {group.displayId}
            </span>
            <RoleBadge Role={group.role} info={false} groupName={group.name} />
            {showPlanBadge && (
              <span className="text-theme-2xs font-bold px-2 py-0.5 rounded-md border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300" translate="no">
                {badgeTier}
              </span>
            )}
            {isClosed && (
              <span className="inline-flex items-center gap-1 text-theme-2xs font-semibold px-2 py-0.5 rounded-md border border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-500/25 dark:bg-warning-500/10 dark:text-warning-300">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                  <path d="M2.5 4V2.5a1.5 1.5 0 113 0V4M2 4h4v3H2z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("groupCard.closed", "Closed")}
              </span>
            )}
          </div>
        </div>

        {/* Balance */}
        <div className="text-right shrink-0">
          <p className="text-theme-2xs text-fg-muted uppercase tracking-wider mb-0.5">{t("groupCard.balance")}</p>
          <p className="font-mono text-theme-xl font-semibold text-fg leading-tight" translate="no">
            ₹{group.balance.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-theme-2xs text-fg-muted uppercase tracking-wider">{t("groupCard.poolRemaining")}</p>
          <p className="text-theme-2xs font-mono text-fg-muted" translate="no">{group.barLength}%</p>
        </div>
        <div className="w-full h-[3px] bg-line rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barTone}`}
            style={{ width: `${group.barLength}%` }}
          />
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MemberAvatars members={group.members} />
          <span className="text-theme-xs text-fg-muted">
            {t("groupCard.expense", { count: group.expenseCount })}
          </span>
        </div>

        {/* An expense needs a category — hide the action until one exists. */}
        {!isClosed && group.categoryCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddExpense();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-theme-xs font-semibold
              text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100
              dark:text-brand-300 dark:bg-brand-500/10 dark:border-brand-500/20 dark:hover:bg-brand-500/20
              active:scale-[0.97] transition-all duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
              <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {t("groupCard.addExpense")}
          </button>
        )}
      </div>
    </div>
  );
};

export default GroupCard;
