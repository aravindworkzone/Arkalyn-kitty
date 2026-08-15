import { useState } from "react";
import { useTranslation } from "react-i18next";
import MemberAvatars from "../ListMember";
import RoleBadge from "../ui/RoleBadge";
import type { GroupMember } from "../../interface/member";
import type { Group } from "../../interface/group";

interface Props {
  members: GroupMember[] | undefined;
  leftContributors: GroupMember[] | undefined;
  memberNames: string[];
  totalContribution: number;
  groupName: string | undefined;
  isAdmin: boolean;
  onViewCredits: () => void;
  onRemoveMember: (target: { id: string; name: string }) => void;
}

/** Collapsible member roster: contribution shares, left contributors, and the
 *  per-member rows with their remove action. */
export default function GroupMembersPanel({
  members,
  leftContributors,
  memberNames,
  totalContribution,
  groupName,
  isAdmin,
  onViewCredits,
  onRemoveMember,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const share = (contribution: number) =>
    totalContribution > 0 ? Math.round((contribution / totalContribution) * 100) : 0;

  return (
    <div className="bg-surface-raised border border-line rounded-2xl overflow-hidden shadow-theme-xs">
      <button
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 sm:px-6 py-4 hover:bg-surface-hover active:bg-surface-hover transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <div className="flex items-center gap-3">
          <MemberAvatars members={memberNames} />
          <span className="text-theme-xs font-medium text-fg-muted">
            {t("groupDetail.membersCount", { count: members?.length ?? 0 })}
          </span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
          className={`text-fg-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-line">
          <div className="px-5 sm:px-6 py-3.5 border-b border-line bg-surface-hover/50">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-theme-2xs uppercase tracking-widest text-fg-muted">{t("groupDetail.contributions")}</p>
              <button
                onClick={onViewCredits}
                className="text-theme-2xs font-semibold text-success-700 dark:text-success-400 hover:text-success-800 dark:hover:text-success-300
                  transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded"
              >
                {t("groupDetail.viewAllCredits", "View all credits")}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {members?.map((m) => {
                const pct = share(m.contribution);
                return (
                  <div key={m._id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-theme-xs text-fg-muted" translate="no">{m.userId.name}</span>
                      <span className="text-theme-xs font-mono text-fg-muted" translate="no">
                        ₹{m.contribution.toLocaleString("en-IN")}
                        <span className="text-fg-muted ml-1">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-[2px] bg-line rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {(leftContributors?.length ?? 0) > 0 && (
              <div className="mt-4 pt-3 border-t border-line space-y-2">
                <p className="text-theme-2xs uppercase tracking-widest text-fg-muted">
                  {t("groupDetail.leftContributions", "Left member contributions")}
                </p>
                {leftContributors!.map((m) => {
                  const pct = share(m.contribution);
                  return (
                    <div key={m._id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-theme-xs text-fg-muted italic flex items-center gap-1.5" translate="no">
                          {m.userId.name}
                          <span className="text-fg-muted not-italic">
                            · {m.leftMode === "FORFEIT"
                                ? t("groupDetail.forfeited", "forfeited")
                                : t("groupDetail.left", "left")}
                          </span>
                          {m.leftMode === "FORFEIT" && (
                            <span className="text-theme-2xs font-semibold px-1.5 py-0.5 rounded-md not-italic border border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
                              {t("groupDetail.forfeitBadge", "FORFEITED")}
                            </span>
                          )}
                        </span>
                        <span className="text-theme-xs font-mono text-fg-muted" translate="no">
                          ₹{m.contribution.toLocaleString("en-IN")}
                          <span className="text-fg-muted ml-1">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-[2px] bg-line rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-line-strong transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="divide-y divide-line">
            {members?.map((member) => (
              <div key={member._id} className="flex items-center justify-between px-5 sm:px-6 py-3.5 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 dark:bg-brand-500/15 dark:border-brand-500/20
                    flex items-center justify-center text-theme-xs font-bold text-brand-600 dark:text-brand-400 shrink-0" translate="no">
                    {member.userId.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-theme-sm font-medium text-fg leading-tight" translate="no">{member.userId.name}</p>
                    <p className="text-theme-xs text-fg-muted truncate" translate="no">{member.userId.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-theme-xs font-mono text-fg-muted" translate="no">
                      ₹{member.contribution.toLocaleString("en-IN")}
                    </p>
                    {member.settlement && (
                      <p className="text-theme-2xs text-success-700 dark:text-success-400 font-semibold" translate="no">
                        {t("groupDetail.settled")} · ₹{(member.settlementAmount ?? 0).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                  <RoleBadge Role={(member.role as Group["role"]) || "MEMBER"} info={false} groupName={groupName} />
                  {isAdmin && member.role !== "SUPER_ADMIN" && (
                    <button
                      onClick={() => onRemoveMember({ id: member.userId._id, name: member.userId.name })}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-fg-muted transition-colors
                        hover:text-error-600 hover:bg-error-50 active:text-error-600 active:bg-error-50
                        dark:hover:text-error-400 dark:hover:bg-error-500/10 dark:active:text-error-400 dark:active:bg-error-500/10"
                      title={t("groupDetail.removeMemberLabel", { name: member.userId.name })}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 3h8M5 3V2h2v1M4.5 3l.5 6.5M7.5 3l-.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
