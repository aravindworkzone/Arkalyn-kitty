import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GroupMember } from "../../interface/member";
import { ActionButton, MemberSelect } from "../ui";

interface Props {
  members: GroupMember[] | undefined;
  isChangingRole: boolean;
  handleChangeRole: (
    roleMemberId: string,
    roleAction: "promote" | "demote",
    setRoleMemberId: React.Dispatch<React.SetStateAction<string>>,
  ) => Promise<void>;
}

export default function SettingsChangeRole({ members, isChangingRole, handleChangeRole }: Props) {
  const { t } = useTranslation();
  const [roleMemberId, setRoleMemberId] = useState("");
  const [roleAction, setRoleAction] = useState<"promote" | "demote">("promote");

  return (
    <div className="space-y-3">
      <MemberSelect
        members={members}
        value={roleMemberId}
        onChange={setRoleMemberId}
        placeholder={t("groupDetail.selectMember")}
        filter={(m) => m.role !== "SUPER_ADMIN"}
        renderLabel={(m) => `${m.userId.name} · ${m.role === "ADMIN" ? "Admin" : "Member"}`}
      />

      <div className="flex gap-2">
        {(["promote", "demote"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setRoleAction(a)}
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
