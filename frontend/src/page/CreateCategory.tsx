import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetCategoriesQuery, useGetCreditCategoriesQuery } from "../redux/api/category";
import { useCategoryHandlers } from "../handlers/useCategoryHandlers";
import DeleteConfirmModal from "../components/deleteModel";
import CategoryDeleteSummary from "../components/categorySummary";
import { colorOptions } from "../helpers/constants";
import type { Category, CategoryType } from "../interface/category";
import { useFieldError } from "../hooks/useFieldError";
import type { CategoryField } from "../handlers/useCategoryHandlers";
import {
  ActionButton,
  AmountInput,
  Button,
  ColorPicker,
  ErrorMessage,
  FieldInput,
  FormSection,
  INPUT_CLASS,
  Label,
  LimitMeter,
  PageBackground,
  PageHeader,
  SegmentedToggle,
  PageContainer,
  UpgradeNote,
} from "../components/ui";
import { useGroupPlan } from "../hooks/usePlan";
import { centsToRupeeInput, rupeesToCents, formatCents } from "../helpers/money";
import { useTranslation } from "react-i18next";

export default function CategoryPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // Manage both expense and credit categories from this page via a toggle.
  const [categoryType, setCategoryType] = useState<CategoryType>("EXPENSE");
  const isCredit = categoryType === "CREDIT";

  const { handleAdd, handleEditCategory, handleToggleSpecial, handleDelete, isCreating, isUpdating, isDeleting } = useCategoryHandlers(groupId, categoryType);
  const { data: expenseData, isLoading: expenseLoading } = useGetCategoriesQuery(groupId!);
  const { data: creditData, isLoading: creditLoading } = useGetCreditCategoriesQuery(groupId!);
  const data = isCredit ? creditData : expenseData;
  const isLoading = isCredit ? creditLoading : expenseLoading;

  const [name, setName]   = useState("");
  const [color, setColor] = useState(colorOptions[0]);
  // Optional soft spend limit, in rupees as typed. Expense categories only.
  const [limit, setLimit] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<CategoryField>();
  const [apiError, setApiError] = useState("");

  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory]     = useState<Category | null>(null);

  // Inline per-row editor (section 02) — colour and spend limit.
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editColor, setEditColor]   = useState<string>(colorOptions[0]);
  const [editLimit, setEditLimit]   = useState("");
  const [editError, setEditError]   = useState("");

  const openEditor = (cat: Category) => {
    setEditingId(cat._id);
    setEditColor(cat.color);
    setEditLimit(centsToRupeeInput(cat.limitCents));
    setEditError("");
  };
  const closeEditor = () => { setEditingId(null); setEditError(""); };

  useEffect(() => {
    setCategories(data ?? []);
  }, [data, categoryType]);

  // Category headroom on THIS group's plan. The cap is per group across both
  // types, so both lists count toward it — matching the backend's count.
  const { limits: planLimits, tier: planTier } = useGroupPlan(groupId);
  const categoryCap = planLimits.maxCategoriesPerGroup;
  const categoryCount = (expenseData?.length ?? 0) + (creditData?.length ?? 0);
  const categorySeatsLeft = categoryCap === null ? null : Math.max(0, categoryCap - categoryCount);

  const doAdd = () =>
    handleAdd(name, color, rupeesToCents(limit), categories, setFieldError, setApiError, setCategories, setName, setColor, setLimit, colorOptions[0]);

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
      {selectedCategory && <CategoryDeleteSummary category={selectedCategory} unit={isCredit ? "credit" : "expense"} />}
    </DeleteConfirmModal>

    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />


      <PageContainer width="form" as="div">

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-fg-muted hover:text-fg active:text-fg text-theme-xs font-medium transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("createCategory.back")}
        </button>

        <PageHeader
          accent="brand"
          icon={
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M2 4h4v4H2zM8 4h4v4H8zM2 10h4v4H2zM8 10h4v4H8z"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          }
          label={t("createCategory.label")}
          title={t("createCategory.title")}
          description={t("createCategory.description")}
        />

        {/* ── Expense / Credit toggle ── */}
        <div className="mb-2">
          <SegmentedToggle
            options={[
              { value: "EXPENSE", label: t("createCategory.expenseType", "Expense") },
              { value: "CREDIT",  label: t("createCategory.creditType", "Credit") },
            ]}
            value={categoryType}
            onChange={(v) => {
              setCategoryType(v as CategoryType);
              setApiError("");
              clearFieldError("name");
              // The open row editor belongs to the list we're leaving.
              closeEditor();
            }}
            ariaLabel={t("createCategory.label")}
          />
        </div>

        {/* ── 01 Create ── */}
        <FormSection step="01" title={t("createCategory.newCategory")} contentClass="px-5 py-4 space-y-4">
            {/* The cap counts EXPENSE and CREDIT categories together, exactly as
                the backend does, so the warning matches the 402 that would
                follow. */}
            <UpgradeNote
              show={categorySeatsLeft !== null && categorySeatsLeft <= 2}
              groupId={groupId}
              variant={categorySeatsLeft === 0 ? "blocked" : "hint"}
            >
              {categorySeatsLeft === 0
                ? t("upgrade.categoriesFull", {
                    defaultValue:
                      "This group has used all {{cap}} categories its {{tier}} plan allows. Delete one, or raise the plan to add more.",
                    tier: planTier,
                    cap: categoryCap,
                  })
                : t("upgrade.categoriesNearlyFull", {
                    defaultValue: "{{left}} of {{cap}} categories left on the {{tier}} plan.",
                    left: categorySeatsLeft,
                    cap: categoryCap,
                    tier: planTier,
                  })}
            </UpgradeNote>

            <div>
              <Label>{t("createCategory.nameLabel")}</Label>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <FieldInput
                    className={INPUT_CLASS}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isCreating && (e.preventDefault(), doAdd())}
                    error={fieldErrors.name}
                    onClearError={() => clearFieldError("name")}
                    placeholder={t("createCategory.namePlaceholder")}
                    autoComplete="off"
                    maxLength={40}
                    disabled={isCreating}
                  />
                </div>
                <ActionButton
                  tone="brand"
                  fullWidth={false}
                  onClick={doAdd}
                  loading={isCreating}
                  loadingLabel={t("createCategory.adding", "Adding…")}
                  className="shrink-0 px-4"
                >
                  {t("createCategory.add")}
                </ActionButton>
              </div>
              {apiError && <div className="mt-1.5"><ErrorMessage error={apiError} /></div>}
            </div>

            {/* Spend limit — expense categories only; credits are money coming
                in, so a cap on them means nothing. */}
            {!isCredit && (
              <div>
                <Label>
                  {t("createCategory.limitLabel", "Spend limit")}
                  <span className="ml-2 text-theme-2xs font-normal text-fg-muted">
                    {t("createCategory.optional", "Optional")}
                  </span>
                </Label>
                <AmountInput
                  size="md"
                  value={limit}
                  onChange={setLimit}
                  placeholder={t("createCategory.limitPlaceholder", "e.g. 1500")}
                  inputClassName={INPUT_CLASS}
                />
                <p className="mt-1 text-theme-2xs text-fg-muted">
                  {t(
                    "createCategory.limitHint",
                    "Total for this group. Crossing it only shows a warning — expenses are never blocked."
                  )}
                </p>
              </div>
            )}

            <div>
              <Label>{t("createCategory.colorLabel")}</Label>
              <ColorPicker
                options={colorOptions}
                value={color}
                onChange={setColor}
                customLabel={t("createCategory.customColor")}
                trailing={
                  <div
                    className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl border"
                    style={{ background: color + "18", borderColor: color + "50" }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-theme-xs font-semibold" style={{ color }} translate="no">
                      {name.trim() || t("createCategory.preview")}
                    </span>
                  </div>
                }
              />
            </div>
        </FormSection>

        {/* ── 02 Existing categories ── */}
        <FormSection
          step="02"
          title={t("createCategory.existing")}
          contentClass=""
          headerRight={
            <span className="text-theme-2xs font-medium text-fg-muted bg-surface-hover border border-line px-2 py-0.5 rounded-full" translate="no">
              {t("createCategory.total", { count: categories?.length ?? 0 })}
            </span>
          }
        >
          {isLoading ? (
            <div className="divide-y divide-line">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-hover animate-pulse shrink-0" style={{ animationDelay: `${i * 90}ms` }} />
                    <div className="space-y-1.5">
                      <div className="h-3 w-28 bg-line rounded animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />
                      <div className="h-2.5 w-16 bg-surface-hover rounded animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-surface-hover animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />
                </div>
              ))}
            </div>
          ) : categories?.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-fg-muted text-theme-xs">{t("createCategory.noCategoriesYet")}</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {categories?.map((cat) => (
                <div
                  key={cat._id}
                  className="px-5 py-3.5 hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { if (!isCredit) navigate(`/groups/${groupId}/expenses?categoryId=${cat._id}&label=${encodeURIComponent(cat.name)}`); }}
                    title={isCredit ? cat.name : t("createCategory.viewExpenses", "View expenses in this category")}
                    className={`group/cat flex items-center gap-3 min-w-0 text-left flex-1 mr-2 ${isCredit ? "cursor-default" : ""}`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: cat.color + "20", border: `1px solid ${cat.color}40` }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-theme-sm font-medium text-fg leading-tight truncate transition-colors flex items-center gap-1.5" translate="no">
                        <span className="truncate">{cat.name}</span>
                        {cat.isSpecial && (
                          <span className="shrink-0 text-theme-2xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-warning-50 border border-warning-200 text-warning-800 dark:bg-warning-500/15 dark:border-warning-500/30 dark:text-warning-300">
                            {t("createCategory.collective", "Collective")}
                          </span>
                        )}
                      </p>
                      <p className="text-theme-2xs text-fg-muted mt-0.5" translate="no">
                        {isCredit
                          ? (cat.expenseCount > 0
                              ? t("createCategory.creditCount", { count: cat.expenseCount })
                              : t("createCategory.noCredits", "No credits"))
                          : (cat.expenseCount > 0
                              ? t("createCategory.expense", { count: cat.expenseCount })
                              : t("createCategory.noExpenses"))}
                        {/* The amount rides on the count line only when no meter
                            follows — a limited category already reads its total
                            as "₹8,400 / ₹10,000" below, and printing it twice
                            makes the row noisier, not more informative. */}
                        {!cat.limitCents && (cat.spentCents ?? 0) > 0 && (
                          <>
                            <span className="mx-1.5 text-fg-subtle">·</span>
                            <span className="text-fg font-medium font-mono">
                              {formatCents(cat.spentCents ?? 0, i18n.language)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    {!isCredit && (
                      <svg
                        className="w-3 h-3 shrink-0 text-fg-muted opacity-0 group-hover/cat:opacity-100 transition-all -translate-x-1 group-hover/cat:translate-x-0"
                        viewBox="0 0 12 12" fill="none" aria-hidden="true"
                      >
                        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                  {!isCredit && (
                  <button
                    type="button"
                    onClick={() => handleToggleSpecial(cat, setApiError, setCategories)}
                    title={t("createCategory.toggleCollective", "Toggle collective (excluded from per-member report)")}
                    aria-pressed={cat.isSpecial}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                      cat.isSpecial
                        ? "text-warning-700 bg-warning-50 dark:text-warning-300 dark:bg-warning-500/15"
                        : "text-fg-muted hover:text-warning-700 hover:bg-warning-50 dark:hover:text-warning-300 dark:hover:bg-warning-500/10"
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill={cat.isSpecial ? "currentColor" : "none"} aria-hidden="true">
                      <path d="M7 1.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.7l-3.2 1.7.6-3.6L1.8 5.3l3.6-.5L7 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                    </svg>
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (editingId === cat._id ? closeEditor() : openEditor(cat))}
                    title={isCredit
                      ? t("createCategory.changeColor", "Change colour")
                      : t("createCategory.editCategory", "Edit colour & spend limit")}
                    aria-expanded={editingId === cat._id}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                      editingId === cat._id
                        ? "text-brand-700 bg-brand-50 dark:text-brand-300 dark:bg-brand-500/15"
                        : "text-fg-muted hover:text-brand-700 hover:bg-brand-50 dark:hover:text-brand-300 dark:hover:bg-brand-500/10"
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M9.5 2.5l2 2L5 11l-2.5.5L3 9l6.5-6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className="relative group/del">
                    <button
                      type="button"
                      onClick={() => { setSelectedCategory(cat); setCategoryModalOpen(true); }}
                      disabled={cat.expenseCount > 0}
                      title={t("deleteModal.destructiveAction")}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                        cat.expenseCount > 0
                          ? "text-fg-muted cursor-not-allowed opacity-50"
                          : "text-fg-muted hover:text-error-600 hover:bg-error-50 dark:hover:text-error-400 dark:hover:bg-error-500/10"
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path
                          d="M2 3h8M5 3V2h2v1M4.5 9.5v-5m3 5v-5M3 3l.5 7.5h5L9 3"
                          stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    {cat.expenseCount > 0 && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover/del:flex
                        items-center whitespace-nowrap px-2.5 py-1.5 rounded-lg
                        bg-surface-overlay border border-line text-theme-2xs text-fg-muted shadow-theme-md z-dropdown">
                        {isCredit ? t("createCategory.hasActiveCredits", "Has credits — remove them first") : t("createCategory.hasActiveExpenses")}
                      </div>
                    )}
                  </div>
                  </div>
                  </div>

                  {/* Spend against the limit — only for categories that set one. */}
                  {!isCredit && cat.limitCents ? (
                    <LimitMeter
                      className="mt-2.5"
                      spentCents={cat.spentCents}
                      limitCents={cat.limitCents}
                    />
                  ) : null}

                  {editingId === cat._id && (
                    <div className="mt-3 pt-3 border-t border-line space-y-3">
                      <div>
                        <Label>{t("createCategory.colorLabel")}</Label>
                        <ColorPicker
                          options={colorOptions}
                          value={editColor}
                          onChange={setEditColor}
                          customLabel={t("createCategory.customColor")}
                        />
                      </div>

                      {!isCredit && (
                        <div>
                          <Label>
                            {t("createCategory.limitLabel", "Spend limit")}
                            <span className="ml-2 text-theme-2xs font-normal text-fg-muted">
                              {t("createCategory.limitClearHint", "Leave empty for no limit")}
                            </span>
                          </Label>
                          <AmountInput
                            size="md"
                            value={editLimit}
                            onChange={setEditLimit}
                            placeholder={t("createCategory.limitPlaceholder", "e.g. 1500")}
                            inputClassName={INPUT_CLASS}
                          />
                        </div>
                      )}

                      {editError && <ErrorMessage error={editError} />}

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={closeEditor}
                          disabled={isUpdating}
                        >
                          {t("createCategory.cancel", "Cancel")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleEditCategory(
                              cat,
                              {
                                color: editColor,
                                // Credit categories never carry a limit, so don't
                                // send one for them.
                                ...(isCredit ? {} : { limitCents: rupeesToCents(editLimit) }),
                              },
                              setEditError,
                              setCategories,
                              closeEditor
                            )
                          }
                          loading={isUpdating}
                          loadingLabel={t("createCategory.saving", "Saving…")}
                          disabled={
                            editColor === cat.color &&
                            (isCredit || rupeesToCents(editLimit) === (cat.limitCents ?? null))
                          }
                        >
                          {t("createCategory.saveChanges", "Save")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </FormSection>
      </PageContainer>
    </div>
    </>
  );
}
