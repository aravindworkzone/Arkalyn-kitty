import MemberAvatars from "./ListMember";
import { roleGrade, roleLabel } from "../helpers/constants";
import type { GroupCardProps } from "../interface/group";
import { useTranslation } from "react-i18next";
import { usePlan } from "../hooks/usePlan";


const GroupCard = ({ group, onClick, onAddExpense, onToggleFavorite, isTogglingFavorite }: GroupCardProps) => {
  const { t } = useTranslation();
  const { tier } = usePlan();
  const isClosed = group.status === "CLOSED";
  const isFavorite = !!group.isFavorite;
  // Badge the user's own groups with their paid tier.
  const showPlanBadge = group.role === "SUPER_ADMIN" && tier !== "FREE";
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
      className={`bg-white/[0.03] border rounded-2xl p-5 cursor-pointer transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 ${
        isClosed
          ? "border-amber-500/20 hover:bg-white/[0.05] hover:border-amber-500/30 active:bg-white/[0.05] active:border-amber-500/30"
          : "border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.12] active:bg-white/[0.08] active:border-white/[0.12]"
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[15px] font-semibold leading-tight truncate ${isClosed ? "text-white/60" : "text-[#f0eeff]"}`} translate="no">
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
                  ? "text-amber-300 hover:bg-amber-400/[0.12] active:bg-amber-400/[0.12]"
                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.06] active:text-white/60 active:bg-white/[0.06]"
              } ${isTogglingFavorite ? "opacity-50 cursor-wait" : ""}`}
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill={isFavorite ? "currentColor" : "none"}>
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.05] text-white/40" translate="no">
              {group.displayId}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                roleGrade[group.role]}"
              }`}
            >
              {roleLabel(group.role)}
            </span>
            {showPlanBadge && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-300" translate="no">
                {tier}
              </span>
            )}
            {isClosed && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-amber-500/25 bg-amber-500/[0.08] text-amber-300">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M2.5 4V2.5a1.5 1.5 0 113 0V4M2 4h4v3H2z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("groupCard.closed", "Closed")}
              </span>
            )}
          </div>
        </div>

        {/* Balance */}
        <div className="text-right shrink-0">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{t("groupCard.balance")}</p>
          <p className="font-mono text-[20px] font-semibold text-[#f0eeff] leading-tight" translate="no">
            ₹{group.balance.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider">{t("groupCard.poolRemaining")}</p>
          <p className="text-[10px] font-mono text-white/40" translate="no">{group.barLength}%</p>
        </div>
        <div className="w-full h-[3px] bg-white/[0.07] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${group.barLength}%`,
              background:
                group.barLength > 60
                  ? "#818cf8"
                  : group.barLength > 30
                  ? "#fb923c"
                  : "#f87171",
            }}
          />
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MemberAvatars members={group.members} />
          <span className="text-[11px] text-white/30">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
              text-violet-300 bg-violet-500/10 border border-violet-500/20
              hover:bg-violet-500/20 hover:border-violet-400/40
              active:bg-violet-500/20 active:border-violet-400/40 active:scale-[0.97]
              transition-all duration-150"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M4.5 1v7M1 4.5h7" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {t("groupCard.addExpense")}
          </button>
        )}
      </div>
    </div>
  );
};

export default GroupCard;
