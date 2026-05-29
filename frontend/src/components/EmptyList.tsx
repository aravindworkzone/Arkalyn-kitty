import { useTranslation } from "react-i18next";

const EmptyState = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center relative overflow-hidden
      bg-white/[0.02] border border-dashed border-white/[0.07] rounded-2xl">

      <div className="absolute w-32 h-32 rounded-full bg-violet-500/8 blur-2xl" />

      <div className="relative w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08]
        flex items-center justify-center mb-5 shadow-xl shadow-black/20">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="2" y="6" width="18" height="13" rx="2.5" stroke="#6d6a8a" strokeWidth="1.4" />
          <path d="M6 6V5a5 5 0 0110 0v1" stroke="#6d6a8a" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="11" cy="13" r="1.5" fill="#8b85b0" />
        </svg>
      </div>

      <p className="text-[15px] font-semibold text-white/50 mb-1.5">{t("empty.noGroupsYet")}</p>
      <p className="text-[12px] text-white/25 max-w-[180px] leading-relaxed mb-7">
        {t("empty.noGroupsDesc")}
      </p>

      <button
        onClick={onClick}
        data-tour="create-group"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold
          text-violet-200 bg-violet-500/10 border border-violet-500/20
          hover:bg-violet-500/18 hover:border-violet-400/35
          active:bg-violet-500/18 active:border-violet-400/35 active:scale-[0.97]
          transition-all duration-150 shadow-lg shadow-violet-900/10"
      >
        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-violet-500/30 text-violet-300">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        {t("empty.createFirst")}
      </button>
    </div>
  );
};

export default EmptyState;
