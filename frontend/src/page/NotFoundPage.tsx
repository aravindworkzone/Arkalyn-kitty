import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageBackground } from "../components/ui";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface text-fg flex items-center justify-center px-5 sm:px-6 py-16">
      <PageBackground />

      <div className="relative max-w-lg w-full text-center">
        <p className="text-title-md leading-none font-bold tracking-tight bg-gradient-to-br from-brand-400/80 to-brand-400/60 bg-clip-text text-transparent select-none">
          404
        </p>

        <h1 className="text-xl font-semibold tracking-tight text-[#f0eeff] mt-2">
          {t("notFound.title")}
        </h1>
        <p className="text-fg-muted text-sm mt-2">
          {t("notFound.description")}
        </p>

        <div className="flex items-center justify-center gap-2.5 mt-7">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border
              bg-surface-hover border-line text-fg
              hover:bg-surface-hover hover:text-fg active:bg-surface-hover active:text-fg transition-all duration-150"
          >
            {t("notFound.goBack")}
          </button>
          <button
            type="button"
            onClick={() => navigate("/groups")}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border
              bg-brand-500/10 border-brand-500/25 text-brand-300
              hover:bg-brand-500/20 hover:border-brand-400/40 active:bg-brand-500/20 active:border-brand-400/40 transition-all duration-150"
          >
            {t("notFound.goHome")}
          </button>
        </div>
      </div>
    </div>
  );
}
