import { useTranslation } from "react-i18next";
import MemberAvatars from "../ListMember";
import RoleBadge from "../ui/RoleBadge";
import type { Group } from "../../interface/group";

interface Props {
  group: Group | undefined;
  role: Group["role"];
  memberNames: string[];
  totalContribution: number;
}

/** Group identity, balance, pool health and the member stack. */
export default function GroupSummaryCard({ group, role, memberNames, totalContribution }: Props) {
  const { t } = useTranslation();
  const bar = group?.barLength ?? 0;
  // Pool health, coarse: comfortable / getting low / nearly spent.
  const barTone = bar > 60 ? "bg-brand-500" : bar > 30 ? "bg-warning-500" : "bg-error-500";

  return (
    <div className="bg-surface-raised border border-line rounded-2xl p-5 sm:p-6 shadow-theme-xs">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1.5">
          <h1 className="text-theme-xl font-semibold text-fg leading-tight" translate="no">
            {group?.name}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-theme-2xs font-mono px-2 py-0.5 rounded-md border border-line bg-surface-hover text-fg-muted" translate="no">
              {group?.displayId}
            </span>
            <RoleBadge Role={role || "MEMBER"} groupName={group?.name} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-theme-2xs uppercase tracking-widest text-fg-muted mb-0.5">{t("groupDetail.balance")}</p>
          <p className="font-mono text-title-sm font-semibold text-fg leading-tight" translate="no">
            ₹{group?.balance?.toLocaleString("en-IN")}
          </p>
          <p className="text-theme-2xs font-mono text-fg-muted mt-0.5" translate="no">
            {t("groupDetail.contributed", { amount: totalContribution.toLocaleString("en-IN") })}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-theme-2xs uppercase tracking-widest text-fg-muted">{t("groupDetail.poolRemaining")}</p>
          <p className="text-theme-2xs font-mono text-fg-muted" translate="no">{bar}%</p>
        </div>
        <div className="w-full h-[3px] bg-line rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barTone}`}
            style={{ width: `${bar}%` }}
          />
        </div>
      </div>

      <MemberAvatars members={memberNames} />
    </div>
  );
}
