import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/header";
import { useGetCategoriesQuery } from "../redux/api/category";
import { useGetPaymentMethodQuery, useGetExpenseByIdQuery } from "../redux/api/expense";
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
  DATE_INPUT_EXTRA,
} from "../components/ui";
import { sanitizeAmount, MIN_DATE, todayISODate } from "../helpers/validators";
import { useFieldError } from "../hooks/useFieldError";
import { useTranslation } from "react-i18next";

export const inputCls =
  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-base sm:text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-200";

export const fieldLabel =
  "block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-widest";

export default function CreateExpensePage() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId?: string }>();
  const isEdit = !!expenseId;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userId } = useCurrentUser();
  const currentUserId = userId ?? undefined;
  const { data: paymentTypes = [], isLoading: pmLoading } = useGetPaymentMethodQuery();
  const { data: categories = [], isLoading: catLoading } = useGetCategoriesQuery(groupId!, { skip: !groupId });
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
  const [paymentType, setPaymentType]   = useState("Cash");
  const [paidBy, setPaidBy]             = useState("");
  const [splits, setSplits]             = useState<SplitEntry[]>([]);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<ExpenseField>();
  const [apiError, setApiError]         = useState("");

  const totalAmount = parseFloat(parseFloat(amount || "0").toFixed(2)) || 0;
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
    <div className="min-h-screen bg-[#080c14] text-white">
      <PageBackground />
      <Header />

      <form
        onSubmit={(e) =>
          handleSubmit(e, {
            title, description, totalAmount, maxAmount: effectiveBalance,
            categoryId, paidBy, splits, splitValid, splitEnabled,
            date, paymentType, setFieldError, setApiError,
          })
        }
        className="relative max-w-xl mx-auto px-4 pt-8 pb-18 space-y-3"
      >
        <BackButton />

        <PageHeader
          color="cyan"
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          label={isEdit ? t("editExpense.label", "Edit") : t("createExpense.label")}
          title={isEdit ? t("editExpense.title", "Edit Expense") : t("createExpense.title")}
          description={isEdit ? t("editExpense.description", "Update the details of this expense.") : t("createExpense.description")}
        />

        {/* ── 01 Basic details ── */}
        <FormSection step="01" title={t("createExpense.basicDetails")} contentClass="px-5 py-4 space-y-3">
          <div data-tour="expense-title-field">
            <label className={fieldLabel}>{t("createExpense.titleLabel")}</label>
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
              <span className="text-[10px] text-white/20" translate="no">{title.length}/100</span>
            </div>
          </div>

          <div>
            <label className={fieldLabel}>
              {t("createExpense.descriptionLabel")}
              <span className="ml-2 text-[9px] font-normal text-white/25 normal-case tracking-normal">
                {t("createExpense.optional")}
              </span>
            </label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("createExpense.descriptionPlaceholder")}
              maxLength={500}
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] text-white/20" translate="no">{description.length}/500</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div data-tour="expense-amount-field">
              <label className={fieldLabel}>{t("createExpense.amount")}</label>
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
                <p className={`mt-1 text-[10px] font-medium transition-colors ${
                  amountIsNearLimit ? "text-amber-400/70" : "text-white/20"
                }`}>
                  {t("createExpense.groupBalance", { amount: effectiveBalance.toLocaleString("en-IN") })}
                </p>
              )}
            </div>

            {/* ── Date with quick chips (Idea C) ── */}
            <div>
              <label className={fieldLabel}>{t("createExpense.date")}</label>
              <FieldInput
                className={`${inputCls} text-white/70 ${DATE_INPUT_EXTRA}`}
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
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => { clearFieldError("date"); setDate(preset.value); }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all duration-150 ${
                      date === preset.value
                        ? "bg-cyan-500/15 border-cyan-500/35 text-cyan-300"
                        : "bg-white/[0.03] border-white/[0.07] text-white/30 hover:border-white/20 hover:text-white/50"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FormSection>

        {/* ── 02 Category + Payment ── */}
        <FormSection step="02" title={t("createExpense.categoryPayment")} contentClass="px-5 py-4 space-y-4">
          <div data-tour="expense-category">
            <label className={fieldLabel}>{t("createExpense.category")}</label>
            <div className="flex flex-wrap gap-2">
              {catLoading
                ? [...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 rounded-xl bg-white/[0.05] animate-pulse" style={{ width: `${64 + i * 16}px`, animationDelay: `${i * 80}ms` }} />
                  ))
                : (
                  <>
                    {sortedCategories.map((cat) => (
                      <button
                        key={cat._id}
                        type="button"
                        onClick={() => { clearFieldError("category"); setCategoryId(cat._id); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all duration-150"
                        style={
                          categoryId === cat._id
                            ? { background: cat.color + "25", borderColor: cat.color + "60", color: cat.color }
                            : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }
                        }
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: categoryId === cat._id ? cat.color : "rgba(255,255,255,0.2)" }}
                        />
                        <span translate="no">{cat.name}</span>
                      </button>
                    ))}
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/groups/${groupId}/categories/new`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border border-dashed border-white/[0.12] text-white/30 hover:border-cyan-500/40 hover:text-cyan-400 active:border-cyan-500/40 active:text-cyan-400 transition-all duration-150"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {categories.length === 0 ? t("createExpense.noCategoriesCreate") : t("createExpense.add")}
                      </button>
                    ) : categories.length === 0 ? (
                      <span className="text-[12px] text-white/30 px-1 py-1.5">
                        {t("createExpense.noCategoriesMember", "No categories yet — ask an admin to add one.")}
                      </span>
                    ) : null}
                  </>
                )
              }
            </div>
            {fieldErrors.category && <div className="mt-2"><ErrorMessage error={fieldErrors.category} /></div>}
          </div>

          <div data-tour="expense-payment">
            <label className={fieldLabel}>{t("createExpense.paymentType")}</label>
            <div className="grid grid-cols-4 gap-2">
              {pmLoading
                ? [...Array(4)].map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-white/[0.05] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  ))
                : paymentTypes?.map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPaymentType(pt)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[10px] font-semibold transition-all duration-150 ${
                        paymentType === pt
                          ? "bg-cyan-500/15 border-cyan-500/35 text-cyan-300"
                          : "bg-white/[0.03] border-white/[0.07] text-white/30 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span translate="no">{pt}</span>
                    </button>
                  ))
              }
            </div>
          </div>
        </FormSection>

        {/* ── 03 Paid by ── */}
        <FormSection step="03" title={t("createExpense.paidBy")}>
          <div className="flex flex-wrap gap-2" data-tour="expense-paid-by">
            {membersLoading
              ? [...Array(3)].map((_, i) => (
                  <div key={i} className="h-9 rounded-xl bg-white/[0.05] animate-pulse" style={{ width: `${88 + i * 20}px`, animationDelay: `${i * 80}ms` }} />
                ))
              : groupMembers?.map((member) => (
                  <button
                    key={member.userId._id}
                    type="button"
                    onClick={() => { clearFieldError("paidBy"); setPaidBy(member.userId._id); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all duration-150 ${
                      paidBy === member.userId._id
                        ? "bg-violet-500/15 border-violet-500/35 text-violet-200"
                        : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        paidBy === member.userId._id ? "bg-violet-500/30 text-violet-300" : "bg-white/10 text-white/40"
                      }`}
                      translate="no"
                    >
                      {member.userId?.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span translate="no">{member.userId?.name}</span>
                  </button>
                ))
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
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all duration-150 ${
                    allMembersInSplit
                      ? "bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/15 active:bg-red-500/15"
                      : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:border-cyan-500/30 hover:text-cyan-400"
                  }`}
                >
                  {allMembersInSplit ? t("createExpense.clearAll") : t("createExpense.addAll")}
                </button>
              )}
              {!splitEnabled && (
                <span className="text-[9px] font-medium text-white/30 uppercase tracking-wide">
                  {t("createExpense.optional")}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleToggleSplit(!splitEnabled)}
                aria-label={splitEnabled ? "Disable split tracking" : "Enable split tracking"}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                  splitEnabled ? "bg-cyan-500/70" : "bg-white/10"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                    splitEnabled ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
            </div>
          }
        >
          <div className="flex flex-wrap gap-2" data-tour="expense-split">
            {membersLoading
              ? [...Array(3)].map((_, i) => (
                  <div key={i} className="h-9 rounded-xl bg-white/[0.05] animate-pulse" style={{ width: `${88 + i * 20}px`, animationDelay: `${i * 80}ms` }} />
                ))
              : groupMembers?.map((member) => {
                  const selected = splits.some((s) => s.userId === member._id);
                  return (
                    <button
                      key={member._id}
                      type="button"
                      onClick={() => {
                        clearFieldError("splits");
                        const isAdding = !splits.some((s) => s.userId === member._id);
                        toggleSplit(setSplits, member.userId!);
                        if (isAdding) setSplitEnabled(true);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all duration-150 ${
                        selected
                          ? "bg-cyan-500/15 border-cyan-500/35 text-cyan-200"
                          : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                          selected ? "bg-cyan-500/25 text-cyan-300" : "bg-white/10 text-white/40"
                        }`}
                        translate="no"
                      >
                        {member.userId?.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span translate="no">{member.userId?.name}</span>
                    </button>
                  );
                })
            }
          </div>

          {splits.length > 0 && (
            <div className="space-y-2 pt-1" data-tour="expense-split-amounts">
              {splits.map((split) => (
                <div
                  key={split.userId}
                  className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5"
                >
                  <span className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center text-[10px] font-bold text-cyan-400 shrink-0" translate="no">
                    {split.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-white/60 truncate" translate="no">{split.name}</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 text-xs">₹</span>
                    <input
                      className="w-24 bg-white/[0.05] border border-white/[0.09] rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-white text-right placeholder-white/20 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                      placeholder="0"
                      type="text"
                      value={split.amount || ""}
                      inputMode="decimal"
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
                    className="flex items-center gap-1 text-[10px] font-semibold text-cyan-400/70 hover:text-cyan-300 active:text-cyan-300 transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1 5h8M1 2.5h8M1 7.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    {t("createExpense.splitEqually")}
                  </button>
                ) : (
                  <span className="text-[10px] uppercase tracking-widest text-white/25">{t("createExpense.splitTotal")}</span>
                )}
                <div className="flex items-center gap-2">
                  <span className={`text-[12px] font-mono font-semibold ${
                    splits.length === 0 ? "text-white/25" : splitValid ? "text-emerald-400" : "text-red-400"
                  }`} translate="no">
                    ₹{splitTotal.toLocaleString("en-IN")}
                  </span>
                  <span className="text-white/20 text-[10px]">/</span>
                  <span className="text-[12px] font-mono text-white/40" translate="no">
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </span>
                  {splits.length > 0 && (
                    splitValid ? (
                      <span className="text-emerald-400">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-red-400" translate="no">
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
          submitDataTour="create-expense-submit"
        />
      </form>
    </div>
  );
}
