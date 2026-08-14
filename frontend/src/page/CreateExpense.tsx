import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetCategoriesQuery, useGetCreditCategoriesQuery } from "../redux/api/category";
import {
  useGetPaymentMethodQuery,
  useGetExpenseByIdQuery,
  useLazyCheckDuplicateQuery,
} from "../redux/api/expense";
import type { DuplicateMatch } from "../redux/api/expense";
import { useGetGroupMembersQuery, useGetGroupByIdQuery } from "../redux/api/group";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { SplitEntry } from "../interface/expense";
import {
  useExpenseHandlers, toggleSplit, updateSplitAmount,
  setAllSplits, splitEqually,
} from "../handlers/useExpenseHandlers";
import type { ExpenseField } from "../handlers/useExpenseHandlers";
import {
  PageBackground,
  BackButton,
  PageHeader,
  FormSection,
  ErrorMessage,
  FormActions,
  FieldInput,
  AmountInput,
  Chip,
  Input,
  Label,
  Switch,
  LimitMeter,
  INPUT_CLASS,
  DATE_INPUT_EXTRA,
} from "../components/ui";
import DuplicateNoticeBar from "../components/ui/DuplicateNoticeBar";
import DuplicateExpenseModal from "../components/ui/DuplicateExpenseModal";
import { sanitizeAmount, MIN_DATE, todayISODate } from "../helpers/validators";
import { formatCents, limitStatus } from "../helpers/money";
import { useFieldError } from "../hooks/useFieldError";
import { useTranslation } from "react-i18next";

// Kept as a local alias so the many call sites below stay short. The old
// hand-rolled dark-only string is gone; this is the shared token-driven one.
const inputCls = INPUT_CLASS;

export default function CreateExpensePage() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId?: string }>();
  const isEdit = !!expenseId;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { userId } = useCurrentUser();
  const currentUserId = userId ?? undefined;
  const { data: paymentTypes = [], isLoading: pmLoading } = useGetPaymentMethodQuery();
  const { data: categories = [], isLoading: catLoading } = useGetCategoriesQuery(groupId!, { skip: !groupId });
  const { data: creditCategories = [], isLoading: creditCatLoading } = useGetCreditCategoriesQuery(groupId!, { skip: !groupId });
  const { data: groupMembers = [], isLoading: membersLoading } = useGetGroupMembersQuery(groupId!, { skip: !groupId });
  const { data: groupDetails } = useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const { data: editExpense } = useGetExpenseByIdQuery(
    { groupId: groupId!, expenseId: expenseId! },
    { skip: !isEdit || !groupId }
  );
  const groupBalance = Number(groupDetails?.balance) || 0;
  // When editing, the old amount was already debited from the pool, so the
  // spendable cap is the current balance PLUS the original amount (editing
  // refunds the old then re-debits the new — same as the backend's delta).
  const editOldAmount = isEdit ? Number(editExpense?.amount) || 0 : 0;
  const effectiveBalance = groupBalance + editOldAmount;
  const { handleSubmit, isSubmitting } = useExpenseHandlers(groupId, expenseId);

  // Only admins/super-admins manage categories — members can't create them.
  const role = groupDetails?.role as string | undefined;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [amount, setAmount]             = useState("");
  const [date, setDate]                 = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId]     = useState("");
  const [creditCategoryId, setCreditCategoryId] = useState("");
  const [paymentType, setPaymentType]   = useState("Cash");
  const [paidBy, setPaidBy]             = useState("");
  const [splits, setSplits]             = useState<SplitEntry[]>([]);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<ExpenseField>();
  const [apiError, setApiError]         = useState("");

  const [trigger, { data: dupData }] = useLazyCheckDuplicateQuery();
  const [dupTier, setDupTier] = useState<1 | 2 | null>(null);
  const [dupMatch, setDupMatch] = useState<DuplicateMatch | null>(null);
  const [dupModalOpen, setDupModalOpen] = useState(false);
  const dupBypassRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Debounced duplicate check — fires 400ms after amount/date/category settle.
  // Resets previous match on every field change (auto-dismiss).
  const totalAmount = parseFloat(parseFloat(amount || "0").toFixed(2)) || 0;
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setDupTier(null);
    setDupMatch(null);
    setDupModalOpen(false);

    if (!totalAmount || !date || !groupId) return;

    debounceRef.current = setTimeout(() => {
      trigger({
        groupId,
        amount: totalAmount,
        date,
        category: categoryId || undefined,
        ...(isEdit && expenseId ? { excludeExpenseId: expenseId } : {}),
      });
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [totalAmount, date, categoryId, groupId, isEdit, expenseId, trigger]);

  // Process API response — show notice bar (tier 1) or modal (tier 2).
  // Only run when dupData changes (new API response). Do NOT include categoryId
  // here — the debounce effect already clears dupTier/dupMatch on field change,
  // and adding categoryId would re-run this effect with stale dupData, reopening
  // a modal that should have been dismissed.
  useEffect(() => {
    if (!dupData) return;
    setDupTier(dupData.tier);
    setDupMatch(dupData.match);
    if (dupData.tier === 2 && dupData.match && categoryId) {
      setDupModalOpen(true);
    }
  }, [dupData, categoryId]);

  const handleDupConfirm = () => {
    setDupModalOpen(false);
    dupBypassRef.current = true;
    setDupTier(null);
    setDupMatch(null);
  };

  const handleDupCancel = () => {
    setDupModalOpen(false);
    setDupTier(null);
    setDupMatch(null);
    navigate(-1);
  };

  const splitTotal  = parseFloat(splits.reduce((s, e) => s + (e.amount || 0), 0).toFixed(2));
  const splitDiff   = parseFloat((totalAmount - splitTotal).toFixed(2));
  const splitValid  = splitDiff === 0;

  // Quick date presets
  const todayISO     = new Date().toISOString().split("T")[0];
  const yesterdayISO = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

  // Balance hint coloring
  const amountIsNearLimit = totalAmount > 0 && effectiveBalance > 0 && totalAmount / effectiveBalance > 0.8;

  // Categories sorted by most used
  const sortedCategories = [...categories].sort((a, b) => b.expenseCount - a.expenseCount);

  // ── Category spend limit ──────────────────────────────────────────
  // A soft, group-wide cap on the chosen category. Crossing it warns and
  // nothing more — the submit path is untouched.
  const selectedCategory = categories.find((c) => c._id === categoryId);
  // When editing, this expense's own amount is already inside the category's
  // spent total, so take it back out before adding the new amount — otherwise
  // an untouched edit reads as double the spend. Only applies while the expense
  // stays in the category it was filed under.
  const editingSameCategory = isEdit && editExpense?.category?._id === categoryId;
  const alreadySpentCents = Math.max(
    (selectedCategory?.spentCents ?? 0) - (editingSameCategory ? Math.round(editOldAmount * 100) : 0),
    0
  );
  const projectedSpentCents = alreadySpentCents + Math.round(totalAmount * 100);
  const categoryLimitCents = selectedCategory?.limitCents ?? null;
  const limitInfo = limitStatus(projectedSpentCents, categoryLimitCents);
  const overLimit = limitInfo?.state === "over";

  // "All members in split" flag for Add All / Clear All
  const allMembersInSplit =
    groupMembers.length > 0 && groupMembers.every((m) => splits.some((s) => s.userId === m._id));

  // Prefill all fields from the existing expense when editing (once).
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!isEdit || prefilledRef.current || !editExpense) return;
    prefilledRef.current = true;
    setTitle(editExpense.title);
    setDescription(editExpense.description ?? "");
    setAmount(String(editExpense.amount));
    setDate(new Date(editExpense.date).toISOString().split("T")[0]);
    setCategoryId(editExpense.category._id);
    if (editExpense.creditCategory?._id) setCreditCategoryId(editExpense.creditCategory._id);
    setPaymentType(editExpense.paymentType);
    setPaidBy(editExpense.paidBy._id);
    const editSplits = editExpense.splitBetween.map((s) => ({
      userId: s.userId._id,
      name: s.userId.name,
      amount: s.amount,
    }));
    setSplits(editSplits);
    setSplitEnabled(editSplits.length > 0);
  }, [isEdit, editExpense]);

  // Auto-select first category (most used) when categories load
  useEffect(() => {
    if (isEdit) return;
    if (!catLoading && categories.length > 0 && !categoryId) {
      const sorted = [...categories].sort((a, b) => b.expenseCount - a.expenseCount);
      setCategoryId(sorted[0]._id);
    }
  }, [catLoading, categories.length, categoryId]);

  // Default the credit pool to the most-used credit category. Backend already
  // returns credit categories sorted by usage (most-used first).
  useEffect(() => {
    if (isEdit) return;
    if (!creditCatLoading && creditCategories.length > 0 && !creditCategoryId) {
      setCreditCategoryId(creditCategories[0]._id);
    }
  }, [creditCatLoading, creditCategories.length, creditCategoryId]);

  // Auto-select current user in Who Paid when members load
  useEffect(() => {
    if (isEdit) return;
    if (paidBy || !currentUserId || groupMembers.length === 0) return;
    const me = groupMembers.find((m) => m.userId._id === currentUserId);
    if (me) setPaidBy(me.userId._id);
  }, [paidBy, currentUserId, groupMembers.length]);

  // Auto-turn off toggle when all members removed from splits
  useEffect(() => {
    if (splits.length === 0) setSplitEnabled(false);
  }, [splits.length]);

  const handleToggleSplit = (enabled: boolean) => {
    setSplitEnabled(enabled);
    if (!enabled) setSplits([]);
  };

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />

      <form
        ref={formRef}
        onSubmit={(e) => {
          if (dupTier === 2 && dupMatch && !dupBypassRef.current) {
            e.preventDefault();
            setDupModalOpen(true);
            return;
          }
          dupBypassRef.current = false;
          handleSubmit(e, {
            title, description, totalAmount, maxAmount: effectiveBalance,
            categoryId, creditCategoryId: creditCategoryId || undefined, paidBy, splits, splitValid, splitEnabled,
            date, paymentType, setFieldError, setApiError,
          });
        }}
        className="relative max-w-xl mx-auto px-4 pt-8 pb-18 space-y-3"
      >
        <BackButton />

        <PageHeader
          accent="brand"
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          label={isEdit ? t("editExpense.label", "Edit") : t("createExpense.label")}
          title={isEdit ? t("editExpense.title", "Edit Expense") : t("createExpense.title")}
          description={isEdit ? t("editExpense.description", "Update the details of this expense.") : t("createExpense.description")}
        />

        {/* ── 01 Basic details ── */}
        <FormSection step="01" title={t("createExpense.basicDetails")} contentClass="px-5 py-4 space-y-3">
          <div>
            <Label>{t("createExpense.titleLabel")}</Label>
            <FieldInput
              className={inputCls}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={fieldErrors.title}
              onClearError={() => clearFieldError("title")}
              placeholder={t("createExpense.titlePlaceholder")}
              autoComplete="off"
              maxLength={100}
            />
            <div className="flex justify-end mt-1">
              <span className="text-theme-2xs text-fg-muted" translate="no">{title.length}/100</span>
            </div>
          </div>

          <div>
            <Label>
              {t("createExpense.descriptionLabel")}
              <span className="ml-2 text-theme-2xs font-normal text-fg-muted">
                {t("createExpense.optional")}
              </span>
            </Label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("createExpense.descriptionPlaceholder")}
              maxLength={500}
            />
            <div className="flex justify-end mt-1">
              <span className="text-theme-2xs text-fg-muted" translate="no">{description.length}/500</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("createExpense.amount")}</Label>
              <AmountInput
                size="lg"
                value={amount}
                onChange={setAmount}
                max={effectiveBalance}
                error={fieldErrors.amount}
                onClearError={() => clearFieldError("amount")}
                inputClassName={inputCls}
              />
              {effectiveBalance > 0 && (
                <p className={`mt-1 text-theme-2xs font-medium transition-colors ${
                  amountIsNearLimit ? "text-warning-700 dark:text-warning-400" : "text-fg-muted"
                }`}>
                  {t("createExpense.groupBalance", { amount: effectiveBalance.toLocaleString("en-IN") })}
                </p>
              )}
            </div>

            {/* ── Date with quick chips (Idea C) ── */}
            <div>
              <Label>{t("createExpense.date")}</Label>
              <FieldInput
                className={`${inputCls} ${DATE_INPUT_EXTRA}`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                error={fieldErrors.date}
                onClearError={() => clearFieldError("date")}
                min={MIN_DATE}
                max={todayISODate()}
              />
              <div className="flex gap-1.5 mt-1.5">
                {[
                  { label: t("createExpense.today"),     value: todayISO     },
                  { label: t("createExpense.yesterday"), value: yesterdayISO },
                ].map((preset) => (
                  <Chip
                    key={preset.value}
                    selected={date === preset.value}
                    onClick={() => { clearFieldError("date"); setDate(preset.value); }}
                    className="!px-2.5 !py-1 !rounded-lg !text-theme-2xs"
                  >
                    {preset.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </FormSection>

        {dupTier === 1 && dupMatch && (
          <DuplicateNoticeBar match={dupMatch} />
        )}

        {/* ── 02 Category + Payment ── */}
        <FormSection step="02" title={t("createExpense.categoryPayment")} contentClass="px-5 py-4 space-y-4">
          <div>
            <Label>{t("createExpense.category")}</Label>
            <div className="flex flex-wrap gap-2">
              {catLoading
                ? [...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 rounded-xl bg-surface-hover animate-pulse" style={{ width: `${64 + i * 16}px`, animationDelay: `${i * 80}ms` }} />
                  ))
                : (
                  <>
                    {sortedCategories.map((cat) => (
                      <Chip
                        key={cat._id}
                        selected={categoryId === cat._id}
                        accentColor={cat.color}
                        onClick={() => { clearFieldError("category"); setCategoryId(cat._id); }}
                      >
                        <span translate="no">{cat.name}</span>
                      </Chip>
                    ))}
                    {isAdmin ? (
                      <Chip dashed onClick={() => navigate(`/groups/${groupId}/categories/new`)}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {categories.length === 0 ? t("createExpense.noCategoriesCreate") : t("createExpense.add")}
                      </Chip>
                    ) : categories.length === 0 ? (
                      <span className="text-theme-xs text-fg-muted px-1 py-1.5">
                        {t("createExpense.noCategoriesMember", "No categories yet — ask an admin to add one.")}
                      </span>
                    ) : null}
                  </>
                )
              }
            </div>
            {fieldErrors.category && <div className="mt-2"><ErrorMessage error={fieldErrors.category} /></div>}

            {/* Spend limit for the chosen category, projected to include the
                amount being typed — so the bar turns amber/red as you type. */}
            {selectedCategory && categoryLimitCents ? (
              <div className="mt-3 rounded-xl border border-line bg-surface-raised px-3.5 py-3">
                <p className="text-theme-2xs font-medium text-fg-muted mb-1.5">
                  {t("createExpense.limitFor", "{{name}} limit", { name: selectedCategory.name })}
                </p>
                <LimitMeter spentCents={projectedSpentCents} limitCents={categoryLimitCents} />
                {totalAmount > 0 && (
                  <p className="mt-1.5 text-theme-2xs text-fg-muted" translate="no">
                    {t("createExpense.limitIncludesThis", "Includes this {{amount}} · {{spent}} spent so far", {
                      amount: formatCents(Math.round(totalAmount * 100), i18n.language),
                      spent: formatCents(alreadySpentCents, i18n.language),
                    })}
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {creditCategories.length > 0 && (
            <div>
              <Label>{t("createExpense.creditCategory", "Credit pool")}</Label>
              <div className="flex flex-wrap gap-2">
                {creditCategories.map((cat) => (
                  <Chip
                    key={cat._id}
                    selected={creditCategoryId === cat._id}
                    accentColor={cat.color}
                    onClick={() => setCreditCategoryId(cat._id)}
                  >
                    <span translate="no">{cat.name}</span>
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>{t("createExpense.paymentType")}</Label>
            <div className="grid grid-cols-4 gap-2">
              {pmLoading
                ? [...Array(4)].map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-surface-hover animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  ))
                : paymentTypes?.map((pt) => (
                    <Chip
                      key={pt}
                      selected={paymentType === pt}
                      onClick={() => setPaymentType(pt)}
                      className="!flex-col !gap-1.5 !py-3 !text-theme-2xs justify-center"
                    >
                      <span translate="no">{pt}</span>
                    </Chip>
                  ))
              }
            </div>
          </div>
        </FormSection>

        {/* Soft over-limit warning — advisory only, the form still submits. */}
        {overLimit && selectedCategory && limitInfo && (
          <div
            className="w-full bg-warning-50 border border-warning-200 dark:bg-warning-500/10 dark:border-warning-500/20 rounded-xl px-4 py-3"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2.5">
              <svg
                className="w-4 h-4 mt-0.5 shrink-0 text-warning-600 dark:text-warning-400"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-theme-xs font-semibold text-warning-800 dark:text-warning-300">
                  {t("createExpense.overLimitHeading", "Over the {{name}} limit", {
                    name: selectedCategory.name,
                  })}
                </p>
                <p className="text-theme-2xs text-warning-700 dark:text-warning-200/70 mt-0.5" translate="no">
                  {t(
                    "createExpense.overLimitLine",
                    "This takes {{name}} to {{projected}} against a {{limit}} limit — {{over}} over.",
                    {
                      name: selectedCategory.name,
                      projected: formatCents(projectedSpentCents, i18n.language),
                      limit: formatCents(limitInfo.limitCents, i18n.language),
                      over: formatCents(Math.abs(limitInfo.remainingCents), i18n.language),
                    }
                  )}
                </p>
                <p className="text-theme-2xs text-warning-700/80 dark:text-warning-100/50 mt-1">
                  {t("createExpense.overLimitHint", "You can still save it — this is only a heads-up.")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── 03 Paid by ── */}
        <FormSection step="03" title={t("createExpense.paidBy")}>
          <div className="flex flex-wrap gap-2">
            {membersLoading
              ? [...Array(3)].map((_, i) => (
                  <div key={i} className="h-9 rounded-xl bg-surface-hover animate-pulse" style={{ width: `${88 + i * 20}px`, animationDelay: `${i * 80}ms` }} />
                ))
              : groupMembers?.map((member) => {
                  const selected = paidBy === member.userId._id;
                  return (
                    <Chip
                      key={member.userId._id}
                      selected={selected}
                      dot={false}
                      onClick={() => { clearFieldError("paidBy"); setPaidBy(member.userId._id); }}
                      className="!gap-2 !py-2"
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-theme-2xs font-bold ${
                          selected ? "bg-brand-500/25 text-brand-700 dark:text-brand-300" : "bg-surface-hover text-fg-muted"
                        }`}
                        translate="no"
                      >
                        {member.userId?.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span translate="no">{member.userId?.name}</span>
                    </Chip>
                  );
                })
            }
          </div>
          {fieldErrors.paidBy && <div className="mt-2"><ErrorMessage error={fieldErrors.paidBy} /></div>}
        </FormSection>

        {/* ── 04 Who Spend ── */}
        <FormSection
          step="04"
          title={t("createExpense.splitBetween")}
          contentClass="px-5 py-4 space-y-3"
          headerRight={
            <div className="flex items-center gap-2">
              {!membersLoading && groupMembers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearFieldError("splits");
                    if (allMembersInSplit) {
                      setSplits([]);
                    } else {
                      setAllSplits(setSplits, groupMembers.map((m) => m.userId));
                      setSplitEnabled(true);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-theme-2xs font-semibold border transition-all duration-150
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                    allMembersInSplit
                      ? "bg-error-50 border-error-200 text-error-700 hover:bg-error-100 dark:bg-error-500/10 dark:border-error-500/25 dark:text-error-400 dark:hover:bg-error-500/15"
                      : "bg-surface-raised border-line text-fg-muted hover:border-brand-300 hover:text-brand-600 dark:hover:text-brand-400"
                  }`}
                >
                  {allMembersInSplit ? t("createExpense.clearAll") : t("createExpense.addAll")}
                </button>
              )}
              {!splitEnabled && (
                <span className="text-theme-2xs font-medium text-fg-muted uppercase tracking-wide">
                  {t("createExpense.optional")}
                </span>
              )}
              <Switch
                checked={splitEnabled}
                onChange={handleToggleSplit}
                ariaLabel={splitEnabled ? "Disable split tracking" : "Enable split tracking"}
              />
            </div>
          }
        >
          <div className="flex flex-wrap gap-2">
            {membersLoading
              ? [...Array(3)].map((_, i) => (
                  <div key={i} className="h-9 rounded-xl bg-surface-hover animate-pulse" style={{ width: `${88 + i * 20}px`, animationDelay: `${i * 80}ms` }} />
                ))
              : groupMembers?.map((member) => {
                  const selected = splits.some((s) => s.userId === member._id);
                  return (
                    <Chip
                      key={member._id}
                      selected={selected}
                      dot={false}
                      onClick={() => {
                        clearFieldError("splits");
                        const isAdding = !splits.some((s) => s.userId === member._id);
                        toggleSplit(setSplits, member.userId!);
                        if (isAdding) setSplitEnabled(true);
                      }}
                      className="!gap-2 !py-2"
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-theme-2xs font-bold ${
                          selected ? "bg-brand-500/25 text-brand-700 dark:text-brand-300" : "bg-surface-hover text-fg-muted"
                        }`}
                        translate="no"
                      >
                        {member.userId?.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span translate="no">{member.userId?.name}</span>
                    </Chip>
                  );
                })
            }
          </div>

          {splits.length > 0 && (
            <div className="space-y-2 pt-1">
              {splits.map((split) => (
                <div
                  key={split.userId}
                  className="flex items-center gap-3 bg-surface-raised border border-line rounded-xl px-4 py-2.5"
                >
                  <span className="w-7 h-7 rounded-full bg-brand-50 border border-brand-200 dark:bg-brand-500/15 dark:border-brand-500/20 flex items-center justify-center text-theme-2xs font-bold text-brand-600 dark:text-brand-400 shrink-0" translate="no">
                    {split.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1 text-theme-sm font-medium text-fg truncate" translate="no">{split.name}</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted text-theme-xs z-10">₹</span>
                    <Input
                      size="sm"
                      className="w-24 pl-6 text-right"
                      placeholder="0"
                      type="text"
                      value={split.amount || ""}
                      inputMode="decimal"
                      aria-label={t("createExpense.splitTotal")}
                      onChange={(e) => updateSplitAmount(setSplits, split.userId, Number(sanitizeAmount(e.target.value, totalAmount)))}
                    />
                  </div>
                </div>
              ))}

              {/* Split total row with "÷ Split Equally" (Idea A) */}
              <div className="flex items-center justify-between px-1 pt-1 pb-0.5">
                {totalAmount > 0 ? (
                  <button
                    type="button"
                    onClick={() => { clearFieldError("splits"); splitEqually(setSplits, totalAmount); }}
                    className="flex items-center gap-1 text-theme-2xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M1 5h8M1 2.5h8M1 7.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    {t("createExpense.splitEqually")}
                  </button>
                ) : (
                  <span className="text-theme-2xs uppercase tracking-widest text-fg-muted">{t("createExpense.splitTotal")}</span>
                )}
                <div className="flex items-center gap-2">
                  <span className={`text-theme-xs font-mono font-semibold ${
                    splits.length === 0
                      ? "text-fg-muted"
                      : splitValid
                        ? "text-success-700 dark:text-success-400"
                        : "text-error-600 dark:text-error-400"
                  }`} translate="no">
                    ₹{splitTotal.toLocaleString("en-IN")}
                  </span>
                  <span className="text-fg-muted text-theme-2xs">/</span>
                  <span className="text-theme-xs font-mono text-fg-muted" translate="no">
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </span>
                  {splits.length > 0 && (
                    splitValid ? (
                      <span className="text-success-700 dark:text-success-400">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-theme-2xs font-semibold text-error-600 dark:text-error-400" translate="no">
                        {splitDiff > 0
                          ? t("createExpense.left", { amount: splitDiff.toFixed(2) })
                          : t("createExpense.over", { amount: Math.abs(splitDiff).toFixed(2) })}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
          {fieldErrors.splits && <ErrorMessage error={fieldErrors.splits} />}
        </FormSection>

        <ErrorMessage error={apiError} />

        <FormActions
          isLoading={isSubmitting}
          submitLabel={isEdit ? t("editExpense.save", "Save changes") : t("createExpense.save")}
          loadingLabel={t("createExpense.saving")}
        />
      </form>

      {dupMatch && (
        <DuplicateExpenseModal
          isOpen={dupModalOpen}
          onClose={handleDupCancel}
          onConfirm={handleDupConfirm}
          match={dupMatch}
        />
      )}
    </div>
  );
}
