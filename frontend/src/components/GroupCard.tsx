import MemberAvatars from "./ListMember";

interface Group {
  name: string;
  displayId: string;
  members: string[];
  expenseCount: number;
  balance: number;
  barLength: number;
  createdAt: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MEMBER";
}

interface GroupCardProps {
  group: Group;
  onClick: () => void;
  onAddExpense: () => void;
}

const roleGrade = {
  SUPER_ADMIN: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
  ADMIN: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  MEMBER: "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

const GroupCard = ({ group, onClick, onAddExpense }: GroupCardProps) => (
  <div
    onClick={onClick}
    className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 cursor-pointer
      hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200 group"
  >
    {/* Top row */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[15px] font-semibold text-[#f0eeff] leading-tight">
          {group.name}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.05] text-white/40">
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
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Balance</p>
        <p className="font-mono text-[20px] font-semibold text-[#f0eeff] leading-tight">
          ₹{group.balance.toLocaleString("en-IN")}
        </p>
      </div>
    </div>

    {/* Progress bar */}
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] text-white/30 uppercase tracking-wider">Pool remaining</p>
        <p className="text-[10px] font-mono text-white/40">{group.barLength}%</p>
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
          {group.expenseCount} expense{group.expenseCount !== 1 ? "s" : ""}
        </span>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddExpense();
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
          text-violet-300 bg-violet-500/10 border border-violet-500/20
          hover:bg-violet-500/20 hover:border-violet-400/40 transition-all duration-150"
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M4.5 1v7M1 4.5h7" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Add Expense
      </button>
    </div>
  </div>
);

export default GroupCard;