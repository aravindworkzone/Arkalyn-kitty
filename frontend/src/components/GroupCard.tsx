import MemberAvatars from "./ListMember";
const GroupCard = ({ group, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 cursor-pointer
      hover:bg-white/[0.07] hover:border-white/[0.14] hover:-translate-y-px transition-all"
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div>
          <p className="text-[14px] font-semibold text-[#f0eeff]">{group.name}</p>
          <p className="text-[11px] text-white/30 mt-0.5">
            {group.members.length} members · {group.expenseCount} expenses
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Balance</p>
        <p className="font-mono text-[18px] font-medium text-[#f0eeff]">
          ₹{group.balance.toLocaleString()}
        </p>
      </div>
    </div>

    <div className="mb-4 flex items-center" title="Remaining balance range">
        <div className="w-full h-px bg-white/[0.5]">
            <div
                className="h-px bg-[#c4b4ff] transition-all duration-500"
                style={{ width: `${group.barLength}%` }}
            />
        </div>
        <p className="text-[11px] text-white/30 ml-2">{group.barLength}%</p>
    </div>

    <div className="flex items-center justify-between">
      <MemberAvatars members={group.members} />
      <p className="text-[11px] text-white/25">
        Created on {group.createdAt}
      </p>
    </div>
  </div>
);

export default GroupCard;