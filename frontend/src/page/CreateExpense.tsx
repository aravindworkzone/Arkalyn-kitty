import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/header";
import { useGetCategoriesQuery } from "../redux/api/category";
import { useGetPaymentMethodQuery } from "../redux/api/expense";
import { useGetGroupMembersQuery, useGetGroupByIdQuery } from "../redux/api/group";
import type { SplitEntry } from "../interface/expense";
import { useExpenseHandlers, toggleSplit, updateSplitAmount } from "../handlers/useExpenseHandlers";
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
} from "../components/ui";
import { sanitizeAmount } from "../helpers/validators";
import { useFieldError } from "../hooks/useFieldError";
import { useTranslation } from "react-i18next";

export const inputCls =
  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-200";

export const fieldLabel =
  "block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-widest";

export default function CreateExpensePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: paymentTypes = [], isLoading: pmLoading } = useGetPaymentMethodQuery();
  const { data: categories = [], isLoading: catLoading } = useGetCategoriesQuery(groupId!, { skip: !groupId });
  const { data: groupMembers = [], isLoading: membersLoading } = useGetGroupMembersQuery(groupId!, { skip: !groupId });
  const { data: groupDetails } = useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const groupBalance = Number(groupDetails?.balance) || 0;
  const { handleSubmit, isCreating } = useExpenseHandlers(groupId);

  const [title, setTitle]             = useState("");
  const [amount, setAmount]           = useState("");
  const [date, setDate]               = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId]   = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [paidBy, setPaidBy]           = useState("");
  const [splits, setSplits]           = useState<SplitEntry[]>([]);
  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<ExpenseField>();
  const [apiError, setApiError]       = useState("");

  const totalAmount = Number(amount) || 0;
  const splitTotal  = splits.reduce((s, e) => s + (e.amount || 0), 0);
  const splitDiff   = totalAmount - splitTotal;
  const splitValid  = Math.abs(splitDiff) < 0.01;

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      <PageBackground />
      <Header />

      <form
        onSubmit={(e) =>
          handleSubmit(e, { title, totalAmount, maxAmount: groupBalance, categoryId, paidBy, splits, splitValid, date, paymentType, setFieldError, setApiError })
        }
        className="relative max-w-xl mx-auto px-4 py-10 space-y-3"
      >
        <BackButton />

        <PageHeader
          color="cyan"
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          label={t("createExpense.label")}
          title={t("createExpense.title")}
          description={t("createExpense.description")}
        />

        {/* ── 01 Basic details ── */}
        <FormSection step="01" title={t("createExpense.basicDetails")} contentClass="px-5 py-4 space-y-3">
          <div>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fieldLabel}>{t("createExpense.amount")}</label>
              <AmountInput
                size="lg"
                value={amount}
                onChange={setAmount}
                max={groupBalance}
                error={fieldErrors.amount}
                onClearError={() => clearFieldError("amount")}
                inputClassName={inputCls}
              />
            </div>
            <div>
              <label className={fieldLabel}>{t("createExpense.date")}</label>
              <FieldInput
                className={`${inputCls} text-white/70`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                error={fieldErrors.date}
                onClearError={() => clearFieldError("date")}
              />
            </div>
          </div>
        </FormSection>

        {/* ── 02 Category + Payment ── */}
        <FormSection step="02" title={t("createExpense.categoryPayment")} contentClass="px-5 py-4 space-y-4">
          <div>
            <label className={fieldLabel}>{t("createExpense.category")}</label>
            <div className="flex flex-wrap gap-2">
              {catLoading
                ? [...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 rounded-xl bg-white/[0.05] animate-pulse" style={{ width: `${64 + i * 16}px`, animationDelay: `${i * 80}ms` }} />
                  ))
                : (
                  <>
                    {categories.map((cat) => (
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
                    <button
                      type="button"
                      onClick={() => navigate(`/groups/${groupId}/categories/new`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border border-dashed border-white/[0.12] text-white/30 hover:border-cyan-500/40 hover:text-cyan-400 transition-all duration-150"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      {categories.length === 0 ? t("createExpense.noCategoriesCreate") : t("createExpense.add")}
                    </button>
                  </>
                )
              }
            </div>
            {fieldErrors.category && <div className="mt-2"><ErrorMessage error={fieldErrors.category} /></div>}
          </div>

          <div>
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
                      onClick={() => { setPaymentType(pt) }}
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
          <div className="flex flex-wrap gap-2">
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

        {/* ── 04 Split between ── */}
        <FormSection step="04" title={t("createExpense.splitBetween")} contentClass="px-5 py-4 space-y-3">
          <div className="flex flex-wrap gap-2">
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
                      onClick={() => { clearFieldError("splits"); toggleSplit(setSplits, member.userId!); }}
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
            <div className="space-y-2 pt-1">
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

              <div className="flex items-center justify-between px-1 pt-1 pb-0.5">
                <span className="text-[10px] uppercase tracking-widest text-white/25">{t("createExpense.splitTotal")}</span>
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
                          ? t("createExpense.left", { amount: splitDiff.toFixed(0) })
                          : t("createExpense.over", { amount: Math.abs(splitDiff).toFixed(0) })}
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
          isLoading={isCreating}
          submitLabel={t("createExpense.save")}
          loadingLabel={t("createExpense.saving")}
        />
      </form>
    </div>
  );
}
