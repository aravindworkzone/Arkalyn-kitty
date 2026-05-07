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
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg
        bg-white/[0.04] border border-white/[0.07]
        hover:bg-white/[0.08] hover:border-white/[0.12]
        active:scale-[0.95] transition-all duration-150"
    >
      <span className="text-[11px] font-semibold text-white/55">
        {isTamil ? "EN" : "தமிழ்"}
      </span>
    </button>
  );
}
