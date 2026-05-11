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
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  : "bg-slate-500/15 border-slate-500/30 text-slate-300"
                : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"
              }`}
          >
            {a === "promote" ? t("groupDetail.promoteToAdmin") : t("groupDetail.demoteToMember")}
          </button>
        ))}
      </div>

      <ActionButton
        tone="amber"
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
