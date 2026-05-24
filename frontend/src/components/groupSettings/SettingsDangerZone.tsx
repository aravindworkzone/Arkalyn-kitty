import { useTranslation } from "react-i18next";
import { ActionButton } from "../ui";

interface Props {
  isSuperAdmin: boolean;
  onRequestDeleteGroup: () => void;
  onRequestLeaveGroup: () => void;
  onRequestForfeitLeave: () => void;
  onRequestCloseGroup?: () => void;
  hasPendingLeave?: boolean;
  onCancelOwnLeave?: () => void;
  isCancellingOwnLeave?: boolean;
}

export default function SettingsDangerZone({
  isSuperAdmin,
  onRequestDeleteGroup,
  onRequestLeaveGroup,
  onRequestForfeitLeave,
  onRequestCloseGroup,
  hasPendingLeave,
  onCancelOwnLeave,
  isCancellingOwnLeave,
}: Props) {
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
        <div className="space-y-3">
          {hasPendingLeave && (
            <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-xl px-4 py-4">
              <p className="text-xs font-semibold text-amber-300 mb-1">
                {t("groupDetail.pendingLeaveTitle", "Leave request pending")}
              </p>
              <p className="text-[11px] text-white/40 mb-3">
                {t(
                  "groupDetail.pendingLeaveDesc",
                  "Your leave request is awaiting admin approval. You can cancel it to stay in the group, or leave without settlement to exit immediately."
                )}
              </p>
              <ActionButton
                tone="amber"
                onClick={onCancelOwnLeave}
                disabled={isCancellingOwnLeave}
              >
                {isCancellingOwnLeave
                  ? t("groupDetail.cancellingLeave", "Cancelling…")
                  : t("groupDetail.cancelLeaveRequest", "Cancel leave request")}
              </ActionButton>
            </div>
          )}
          <div className="bg-amber-500/[0.06] border border-amber-500/15 rounded-xl px-4 py-4">
            <p className="text-xs font-semibold text-amber-400 mb-1">
              {t("groupDetail.leaveWithSettlement", "Leave with settlement")}
            </p>
            <p className="text-[11px] text-white/30 mb-3">
              {t(
                "groupDetail.leaveWithSettlementDesc",
                "If your settlement is done you leave right away. Otherwise a leave request is sent to the group admins for approval."
              )}
            </p>
            <ActionButton tone="amber" onClick={onRequestLeaveGroup}>
              {t("groupDetail.leaveWithSettlement", "Leave with settlement")}
            </ActionButton>
          </div>
          <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl px-4 py-4">
            <p className="text-xs font-semibold text-red-400 mb-1">
              {t("groupDetail.leaveWithoutSettlement", "Leave without settlement")}
            </p>
            <p className="text-[11px] text-white/30 mb-3">
              {t(
                "groupDetail.leaveWithoutSettlementDesc",
                "Leave instantly without admin approval. Your contribution stays in the group pool and will not be refunded. This cannot be undone."
              )}
            </p>
            <ActionButton tone="red" onClick={onRequestForfeitLeave}>
              {t("groupDetail.leaveWithoutSettlement", "Leave without settlement")}
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
