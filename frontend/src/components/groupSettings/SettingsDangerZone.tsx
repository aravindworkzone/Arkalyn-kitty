import { useTranslation } from "react-i18next";
import { ActionButton } from "../ui";

interface Props {
  isSuperAdmin: boolean;
  onRequestDeleteGroup: () => void;
  onRequestLeaveGroup: () => void;
  onRequestCloseGroup?: () => void;
}

export default function SettingsDangerZone({ isSuperAdmin, onRequestDeleteGroup, onRequestLeaveGroup, onRequestCloseGroup }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {isSuperAdmin ? (
        <>
          {onRequestCloseGroup && (
            <div className="bg-amber-500/[0.06] border border-amber-500/15 rounded-xl px-4 py-4">
              <p className="text-xs font-semibold text-amber-400 mb-1">
                {t("closeGroup.title", "Close Group")}
              </p>
              <p className="text-[11px] text-white/30 mb-3">
                {t(
                  "closeGroup.dangerDesc",
                  "Refund the remaining balance to members and lock the group. No further changes can be made after closing."
                )}
              </p>
              <ActionButton tone="amber" onClick={onRequestCloseGroup}>
                {t("closeGroup.title", "Close Group")}
              </ActionButton>
            </div>
          )}
          <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl px-4 py-4">
            <p className="text-xs font-semibold text-red-400 mb-1">{t("groupDetail.deleteGroup")}</p>
            <p className="text-[11px] text-white/30 mb-3">{t("groupDetail.deleteGroupDesc")}</p>
            <ActionButton tone="red" onClick={onRequestDeleteGroup}>
              {t("groupDetail.deleteGroup")}
            </ActionButton>
          </div>
        </>
      ) : (
        <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl px-4 py-4">
          <p className="text-xs font-semibold text-red-400 mb-1">{t("groupDetail.leaveGroup", "Leave Group")}</p>
          <p className="text-[11px] text-white/30 mb-3">
            {t(
              "groupDetail.leaveGroupDesc",
              "If your settlement is done you leave right away. Otherwise a leave request is sent to the group admins for approval."
            )}
          </p>
          <ActionButton tone="red" onClick={onRequestLeaveGroup}>
            {t("groupDetail.leaveGroup", "Leave Group")}
          </ActionButton>
        </div>
      )}
    </div>
  );
}
