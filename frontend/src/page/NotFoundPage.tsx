import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageBackground } from "../components/ui";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#080c14] text-white flex items-center justify-center px-4">
      <PageBackground />

      <div className="relative max-w-md w-full text-center">
        <p className="text-[120px] leading-none font-bold tracking-tight bg-gradient-to-br from-violet-400/80 to-cyan-400/60 bg-clip-text text-transparent select-none">
          404
        </p>

        <h1 className="text-xl font-semibold tracking-tight text-[#f0eeff] mt-2">
          {t("notFound.title")}
        </h1>
        <p className="text-white/40 text-sm mt-2">
          {t("notFound.description")}
        </p>

        <div className="flex items-center justify-center gap-2.5 mt-7">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border
              bg-white/[0.04] border-white/[0.08] text-white/60
              hover:bg-white/[0.07] hover:text-white/80 transition-all duration-150"
          >
            {t("notFound.goBack")}
          </button>
          <button
            type="button"
            onClick={() => navigate("/groups")}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border
              bg-violet-500/10 border-violet-500/25 text-violet-300
              hover:bg-violet-500/20 hover:border-violet-400/40 transition-all duration-150"
          >
            {t("notFound.goHome")}
          </button>
        </div>
      </div>
    </div>
  );
}
