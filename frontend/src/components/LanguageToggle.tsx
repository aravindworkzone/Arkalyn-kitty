import { useTranslation } from "react-i18next";

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const isTamil = i18n.language === "ta";

  const toggle = () => {
    const next = isTamil ? "en" : "ta";
    i18n.changeLanguage(next);
    localStorage.setItem("i18n_lang", next);
  };

  return (
    <button
      onClick={toggle}
      title={isTamil ? "Switch to English" : "தமிழுக்கு மாறுக"}
      className="flex h-8 items-center gap-1 px-2.5 rounded-lg
        bg-surface-hover border border-line text-fg-muted
        hover:text-fg active:scale-[0.95] transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <span className="text-theme-xs font-semibold">
        {isTamil ? "EN" : "தமிழ்"}
      </span>
    </button>
  );
}
