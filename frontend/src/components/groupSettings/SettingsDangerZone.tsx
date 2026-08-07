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
            <div className="bg-warning-50 dark:bg-warning-500/[0.06] border border-warning-200 dark:border-warning-500/15 rounded-xl px-4 py-4">
              <p className="text-xs font-semibold text-warning-700 dark:text-warning-300 mb-1">
                {t("closeGroup.title", "Close Group")}
              </p>
              <p className="text-theme-xs text-fg-muted mb-3">
                {t(
                  "closeGroup.dangerDesc",
                  "Refund the remaining balance to members and lock the group. No further changes can be made after closing."
                )}
              </p>
              <ActionButton tone="warning" onClick={onRequestCloseGroup}>
                {t("closeGroup.title", "Close Group")}
              </ActionButton>
            </div>
          )}
          <div className="bg-error-50 dark:bg-error-500/[0.06] border border-error-200 dark:border-error-500/15 rounded-xl px-4 py-4">
            <p className="text-xs font-semibold text-error-600 dark:text-error-400 mb-1">{t("groupDetail.deleteGroup")}</p>
            <p className="text-theme-xs text-fg-muted mb-3">{t("groupDetail.deleteGroupDesc")}</p>
            <ActionButton tone="error" onClick={onRequestDeleteGroup}>
              {t("groupDetail.deleteGroup")}
            </ActionButton>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {hasPendingLeave && (
            <div className="bg-warning-50 dark:bg-warning-500/[0.06] border border-warning-200 dark:border-warning-500/20 rounded-xl px-4 py-4">
              <p className="text-xs font-semibold text-warning-700 dark:text-warning-300 mb-1">
                {t("groupDetail.pendingLeaveTitle", "Leave request pending")}
              </p>
              <p className="text-theme-xs text-fg-muted mb-3">
                {t(
                  "groupDetail.pendingLeaveDesc",
                  "Your leave request is awaiting admin approval. You can cancel it to stay in the group, or leave without settlement to exit immediately."
                )}
              </p>
              <ActionButton
                tone="warning"
                onClick={onCancelOwnLeave}
                disabled={isCancellingOwnLeave}
              >
                {isCancellingOwnLeave
                  ? t("groupDetail.cancellingLeave", "Cancelling…")
                  : t("groupDetail.cancelLeaveRequest", "Cancel leave request")}
              </ActionButton>
            </div>
          )}
          <div className="bg-warning-50 dark:bg-warning-500/[0.06] border border-warning-200 dark:border-warning-500/15 rounded-xl px-4 py-4">
            <p className="text-xs font-semibold text-warning-700 dark:text-warning-300 mb-1">
              {t("groupDetail.leaveWithSettlement", "Leave with settlement")}
            </p>
            <p className="text-theme-xs text-fg-muted mb-3">
              {t(
                "groupDetail.leaveWithSettlementDesc",
                "If your settlement is done you leave right away. Otherwise a leave request is sent to the group admins for approval."
              )}
            </p>
            <ActionButton tone="warning" onClick={onRequestLeaveGroup}>
              {t("groupDetail.leaveWithSettlement", "Leave with settlement")}
            </ActionButton>
          </div>
          <div className="bg-error-50 dark:bg-error-500/[0.06] border border-error-200 dark:border-error-500/15 rounded-xl px-4 py-4">
            <p className="text-xs font-semibold text-error-600 dark:text-error-400 mb-1">
              {t("groupDetail.leaveWithoutSettlement", "Leave without settlement")}
            </p>
            <p className="text-theme-xs text-fg-muted mb-3">
              {t(
                "groupDetail.leaveWithoutSettlementDesc",
                "Leave instantly without admin approval. Your contribution stays in the group pool and will not be refunded. This cannot be undone."
              )}
            </p>
            <ActionButton tone="error" onClick={onRequestForfeitLeave}>
              {t("groupDetail.leaveWithoutSettlement", "Leave without settlement")}
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
