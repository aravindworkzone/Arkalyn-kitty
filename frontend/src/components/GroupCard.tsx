import MemberAvatars from "./ListMember";
import { roleGrade } from "../helpers/constants";
import type { GroupCardProps } from "../interface/group";
import { useTranslation } from "react-i18next";


const GroupCard = ({ group, onClick, onAddExpense }: GroupCardProps) => {
  const { t } = useTranslation();
  return (
    <div
      onClick={onClick}
      className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 cursor-pointer
        hover:bg-white/[0.06] hover:border-white/[0.12] active:bg-white/[0.08] active:border-white/[0.12]
        transition-all duration-200 group"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px] font-semibold text-[#f0eeff] leading-tight" translate="no">
            {group.name}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.05] text-white/40" translate="no">
              {group.displayId}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                roleGrade[group.role]}"
              }`}
            >
              {group.role}
            </span>
          </div>
        </div>

        {/* Balance */}
        <div className="text-right">
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
      </div>
    </div>
  );
};

export default GroupCard;
