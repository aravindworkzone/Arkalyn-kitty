import { useTranslation } from "react-i18next";
import { ActionButton } from "./ui";

const EmptyState = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center relative overflow-hidden
      bg-surface-raised border border-dashed border-line rounded-2xl">

      <div className="absolute w-32 h-32 rounded-full bg-brand-500/10 blur-2xl" />

      <div className="relative w-14 h-14 rounded-2xl bg-surface-hover border border-line
        flex items-center justify-center mb-5 shadow-theme-md text-fg-muted">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <rect x="2" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 6V5a5 5 0 0110 0v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="11" cy="13" r="1.5" fill="currentColor" />
        </svg>
      </div>

      <p className="text-theme-sm font-semibold text-fg mb-1.5">{t("empty.noGroupsYet")}</p>
      <p className="text-theme-xs text-fg-muted max-w-[180px] leading-relaxed mb-7">
        {t("empty.noGroupsDesc")}
      </p>

      <ActionButton
        tone="brand"
        fullWidth={false}
        onClick={onClick}
        className="flex items-center gap-2 px-5"
      >
        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-brand-500/30">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        {t("empty.createFirst")}
      </ActionButton>
    </div>
  );
};

export default EmptyState;
