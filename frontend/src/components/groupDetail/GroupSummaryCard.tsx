import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import MemberAvatars from "../ListMember";
import RoleBadge from "../ui/RoleBadge";
import type { Group } from "../../interface/group";
import { hasUpgradeAvailable } from "../../helpers/plans";

interface Props {
  group: Group | undefined;
  role: Group["role"];
  memberNames: string[];
  totalContribution: number;
}

/** Group identity, balance, pool health, plan and the member stack. */
export default function GroupSummaryCard({ group, role, memberNames, totalContribution }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const bar = group?.barLength ?? 0;
  // Pool health, coarse: comfortable / getting low / nearly spent.
  const barTone = bar > 60 ? "bg-brand-500" : bar > 30 ? "bg-warning-500" : "bg-error-500";

  // The group's own tier, shown next to its ID because that is what it is: an
  // attribute of this group, not of whoever is looking. Admins get a tappable
  // chip straight to its checkout; members see the same fact, un-tappable,
  // since they can't buy.
  //
  // A closed group's plan is frozen, so offering an upgrade there would be a
  // dead end — the chip stays flat.
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isClosed = group?.status === "CLOSED";
  const tier = group?.subscription?.tier ?? "FREE";
  const canUpgrade = isAdmin && !isClosed && hasUpgradeAvailable(tier);

  const tierChip =
    tier === "FREE"
      ? "border-line bg-surface-hover text-fg-muted"
      : tier === "PRO"
        ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300"
        : "border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-500/25 dark:bg-warning-500/10 dark:text-warning-300";

  return (
    <div className="bg-surface-raised border border-line rounded-2xl p-5 sm:p-6 shadow-theme-xs">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1.5">
          <h1 className="text-theme-xl font-semibold text-fg leading-tight" translate="no">
            {group?.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-theme-2xs font-mono px-2 py-0.5 rounded-md border border-line bg-surface-hover text-fg-muted" translate="no">
              {group?.displayId}
            </span>
            <RoleBadge Role={role || "MEMBER"} groupName={group?.name} />

            {canUpgrade ? (
              <button
                onClick={() => navigate(`/pricing?group=${group?._id}`)}
                title={t("upgrade.chipTitle", "See plans for this group")}
                className={`text-theme-2xs font-semibold px-2 py-0.5 rounded-md border transition-colors
                  hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40
                  inline-flex items-center gap-1 ${tierChip}`}
                translate="no"
              >
                {tier}
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <span
                className={`text-theme-2xs font-semibold px-2 py-0.5 rounded-md border ${tierChip}`}
                translate="no"
              >
                {tier}
              </span>
            )}
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
