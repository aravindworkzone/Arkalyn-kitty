import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GroupMember } from "../../interface/member";
import { ActionButton, MemberSelect, UpgradeNote } from "../ui";

interface Props {
  members: GroupMember[] | undefined;
  isChangingRole: boolean;
  /** Whether this group's plan offers the MEMBER role at all. */
  canDemote: boolean;
  groupId?: string;
  handleChangeRole: (
    roleMemberId: string,
    roleAction: "promote" | "demote",
    setRoleMemberId: React.Dispatch<React.SetStateAction<string>>,
  ) => Promise<void>;
}

export default function SettingsChangeRole({
  members,
  isChangingRole,
  canDemote,
  groupId,
  handleChangeRole,
}: Props) {
  const { t } = useTranslation();
  const [roleMemberId, setRoleMemberId] = useState("");
  const [pickedAction, setPickedAction] = useState<"promote" | "demote">("promote");

  // A flat group has no MEMBER role to demote into, so the action is withdrawn
  // rather than left to fail with a 402. Anyone still holding MEMBER from before
  // the plan lapsed keeps it — promoting them out is the only move left, which
  // is exactly what remains on offer here.
  //
  // Derived rather than written back into state on a plan change: a stale
  // "demote" sitting in state would submit on the next click before any effect
  // could correct it.
  const roleAction = canDemote ? pickedAction : "promote";
  const actions = canDemote ? (["promote", "demote"] as const) : (["promote"] as const);

  return (
    <div className="space-y-3">
      <UpgradeNote show={!canDemote} groupId={groupId} variant="blocked">
        {t(
          "upgrade.memberRole",
          "This group is flat — everyone who joins can administer it. Upgrade its plan to add people who take part without managing the group."
        )}
      </UpgradeNote>

      <MemberSelect
        members={members}
        value={roleMemberId}
        onChange={setRoleMemberId}
        placeholder={t("groupDetail.selectMember")}
        filter={(m) => m.role !== "SUPER_ADMIN"}
        renderLabel={(m) => `${m.userId.name} · ${m.role === "ADMIN" ? "Admin" : "Member"}`}
      />

      <div className="flex gap-2">
        {actions.map((a) => (
          <button
            key={a}
            onClick={() => setPickedAction(a)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all
              ${roleAction === a
                ? a === "promote"
                  ? "bg-warning-50 dark:bg-warning-500/15 border-warning-200 dark:border-warning-500/30 text-warning-700 dark:text-warning-300"
                  : "bg-surface-hover border-line text-fg-muted"
                : "bg-surface-raised border-line text-fg-muted hover:text-fg-muted"
              }`}
          >
            {a === "promote" ? t("groupDetail.promoteToAdmin") : t("groupDetail.demoteToMember")}
          </button>
        ))}
      </div>

      <ActionButton
        tone="warning"
        loading={isChangingRole}
        loadingLabel={t("groupDetail.updatingRole")}
        disabled={!roleMemberId}
        onClick={() => handleChangeRole(roleMemberId, roleAction, setRoleMemberId)}
      >
        {t("groupDetail.changeRole")}
      </ActionButton>
    </div>
  );
}
