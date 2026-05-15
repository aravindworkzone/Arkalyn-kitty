import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/header";
import { useGetCategoriesQuery } from "../redux/api/category";
import { useCategoryHandlers } from "../handlers/useCategoryHandlers";
import DeleteConfirmModal from "../components/deleteModel";
import CategoryDeleteSummary from "../components/categorySummary";
import { colorOptions } from "../helpers/constants";
import type { Category } from "../interface/category";
import { useFieldError } from "../hooks/useFieldError";
import type { CategoryField } from "../handlers/useCategoryHandlers";
import { FieldInput, ErrorMessage } from "../components/ui";
import { useTranslation } from "react-i18next";

const s = {
  input:
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-base sm:text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-200",
  section:
    "bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden",
  sectionHeader:
    "flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]",
};

export default function CategoryPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { handleAdd, handleDelete, isDeleting } = useCategoryHandlers(groupId);
  const { data } = useGetCategoriesQuery(groupId);

  const [name, setName]   = useState("");
  const [color, setColor] = useState(colorOptions[0]);
  const [categories, setCategories] = useState<Category[]>([]);

  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<CategoryField>();
  const [apiError, setApiError] = useState("");

  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory]     = useState<Category | null>(null);

  const customColorRef = useRef<HTMLInputElement>(null);
  const isCustomColor = !colorOptions.includes(color);

  useEffect(() => {
    if (data) setCategories(data);
  }, [data]);

  const doAdd = () =>
    handleAdd(name, color, categories, setFieldError, setApiError, setCategories, setName, setColor, colorOptions[0]);

  return (
    <>
    <DeleteConfirmModal
      isOpen={isCategoryModalOpen}
      onClose={() => { setCategoryModalOpen(false); setSelectedCategory(null); }}
      onConfirm={() => handleDelete(selectedCategory, setApiError, setCategories, setCategoryModalOpen, setSelectedCategory)}
      confirmText="DELETE"
      isBlocked={(selectedCategory?.expenseCount ?? 0) > 0}
      isLoading={isDeleting}
      label={t("deleteModal.destructiveAction")}
    >
      {selectedCategory && <CategoryDeleteSummary category={selectedCategory} />}
    </DeleteConfirmModal>

    <div className="min-h-screen bg-[#080c14] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-60 w-[600px] h-[600px] rounded-full bg-violet-600/4 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.07) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <Header />

      <div className="relative max-w-xl mx-auto px-4 pt-8 pb-18 space-y-3">

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/35 hover:text-white/60 active:text-white/60 text-xs font-medium transition-colors mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("createCategory.back")}
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 4h4v4H2zM8 4h4v4H8zM2 10h4v4H2zM8 10h4v4H8z"
                  stroke="#a78bfa" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/70">
              {t("createCategory.label")}
            </p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f0eeff]">
            {t("createCategory.title")}
          </h1>
          <p className="text-white/35 text-sm mt-1.5">
            {t("createCategory.description")}
          </p>
        </div>

        {/* ── 01 Create ── */}
        <div className={s.section}>
          <div className={s.sectionHeader}>
            <span className="text-[11px] font-bold text-white/15 tabular-nums">01</span>
            <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              {t("createCategory.newCategory")}
            </span>
          </div>
          <div className="px-5 py-4 space-y-4">

            <div>
              <label className="block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-widest">
                {t("createCategory.nameLabel")}
              </label>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <FieldInput
                    className={s.input}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doAdd())}
                    error={fieldErrors.name}
                    onClearError={() => clearFieldError("name")}
                    placeholder={t("createCategory.namePlaceholder")}
                    autoComplete="off"
                    maxLength={40}
                  />
                </div>
                <button
                  type="button"
                  onClick={doAdd}
                  className="shrink-0 px-4 py-3 rounded-xl text-sm font-semibold border
                    bg-violet-500/10 border-violet-500/25 text-violet-300
                    hover:bg-violet-500/20 hover:border-violet-400/40
                    active:bg-violet-500/20 active:border-violet-400/40 active:scale-[0.97]
                    transition-all duration-150"
                >
                  {t("createCategory.add")}
                </button>
              </div>
              {apiError && <div className="mt-1.5"><ErrorMessage error={apiError} /></div>}
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-white/40 mb-2.5 uppercase tracking-widest">
                {t("createCategory.colorLabel")}
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full transition-all duration-150 flex items-center justify-center"
                    style={{
                      background: c,
                      boxShadow: color === c ? `0 0 0 2px #080c14, 0 0 0 3.5px ${c}` : "none",
                      transform: color === c ? "scale(1.15)" : "scale(1)",
                    }}
                  >
                    {color === c && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5 3.5-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}

                {isCustomColor && (
                  <button
                    type="button"
                    onClick={() => customColorRef.current?.click()}
                    className="w-7 h-7 rounded-full transition-all duration-150 flex items-center justify-center"
                    style={{
                      background: color,
                      boxShadow: `0 0 0 2px #080c14, 0 0 0 3.5px ${color}`,
                      transform: "scale(1.15)",
                    }}
                    title={t("createCategory.customColor")}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5 3.5-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => customColorRef.current?.click()}
                  className="w-7 h-7 rounded-full border border-dashed border-white/20 text-white/40 hover:text-white/70 hover:border-white/40 active:text-white/70 active:border-white/40 flex items-center justify-center transition-colors"
                  title={t("createCategory.customColor")}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M5 1.5v7M1.5 5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
                <input
                  ref={customColorRef}
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="sr-only"
                  aria-label={t("createCategory.customColor")}
                />

                <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl border"
                  style={{ background: color + "18", borderColor: color + "50" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-[11px] font-semibold" style={{ color }} translate="no">
                    {name.trim() || t("createCategory.preview")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 02 Existing categories ── */}
        <div className={s.section}>
          <div className={`${s.sectionHeader} justify-between`}>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-white/15 tabular-nums">02</span>
              <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                {t("createCategory.existing")}
              </span>
            </div>
            <span className="text-[10px] font-medium text-white/25 bg-white/[0.05] border border-white/[0.07] px-2 py-0.5 rounded-full" translate="no">
              {t("createCategory.total", { count: categories?.length ?? 0 })}
            </span>
          </div>

          {categories?.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-white/20 text-xs">{t("createCategory.noCategoriesYet")}</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {categories?.map((cat) => (
                <div
                  key={cat._id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: cat.color + "20", border: `1px solid ${cat.color}40` }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white/80 leading-tight" translate="no">{cat.name}</p>
                      <p className="text-[10px] text-white/25 mt-0.5" translate="no">
                        {cat.expenseCount > 0
                          ? t("createCategory.expense", { count: cat.expenseCount })
                          : t("createCategory.noExpenses")}
                      </p>
                    </div>
                  </div>

                  <div className="relative group/del">
                    <button
                      type="button"
                      onClick={() => { setSelectedCategory(cat); setCategoryModalOpen(true); }}
                      disabled={cat.expenseCount > 0}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 ${
                        cat.expenseCount > 0
                          ? "text-white/15 cursor-not-allowed"
                          : "text-white/25 hover:text-red-400 hover:bg-red-500/10"
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 3h8M5 3V2h2v1M4.5 9.5v-5m3 5v-5M3 3l.5 7.5h5L9 3"
                          stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    {cat.expenseCount > 0 && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover/del:flex
                        items-center whitespace-nowrap px-2.5 py-1.5 rounded-lg
                        bg-[#1a1a2a] border border-white/10 text-[10px] text-white/50 shadow-xl z-10">
                        {t("createCategory.hasActiveExpenses")}
                        <div className="absolute top-full right-3 border-4 border-transparent border-t-[#1a1a2a]" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
