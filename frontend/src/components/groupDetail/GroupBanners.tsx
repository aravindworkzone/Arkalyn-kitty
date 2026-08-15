import { useTranslation } from "react-i18next";

interface Props {
  leaveRequestSent: boolean;
  onDismissLeaveRequest: () => void;
  groupClosed: boolean;
}

/** The two transient notices that sit under the group summary card. */
export default function GroupBanners({ leaveRequestSent, onDismissLeaveRequest, groupClosed }: Props) {
  const { t } = useTranslation();

  return (
    <>
      {leaveRequestSent && (
        <div className="flex items-start gap-3 px-5 py-3.5 rounded-xl bg-success-50 border border-success-200 dark:bg-success-500/10 dark:border-success-500/25">
          <svg className="shrink-0 mt-0.5 text-success-600 dark:text-success-400" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 7.5l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-theme-xs font-semibold text-success-800 dark:text-success-300 leading-tight">
              {t("groupDetail.leaveRequestSentTitle")}
            </p>
            <p className="text-theme-xs text-success-700 dark:text-success-400/70 mt-0.5">
              {t("groupDetail.leaveRequestSentDesc")}
            </p>
          </div>
          <button
            onClick={onDismissLeaveRequest}
            aria-label={t("deleteModal.cancel")}
            className="text-success-600 dark:text-success-500/60 hover:text-success-700 dark:hover:text-success-400 transition-colors shrink-0"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {groupClosed && (
        <div className="flex items-start gap-3 px-5 py-3.5 rounded-xl bg-warning-50 border border-warning-200 dark:bg-warning-500/10 dark:border-warning-500/25">
          <svg className="shrink-0 mt-0.5 text-warning-600 dark:text-warning-400" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M4.5 7l1.8 1.8L9.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-theme-xs font-semibold text-warning-800 dark:text-warning-300 leading-tight">
              {t("closeGroup.bannerTitle", "Group closed")}
            </p>
            <p className="text-theme-xs text-warning-700 dark:text-warning-400/70 mt-0.5">
              {t("closeGroup.bannerDesc", "Refunds were issued and no further changes are allowed.")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
