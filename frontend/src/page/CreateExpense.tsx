import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetCategoriesQuery,
  useGetCreditCategoriesQuery,
} from "../redux/api/category";
import { useGetGroupLinksQuery } from "../redux/api/groupLink";
import {
  useGetPaymentMethodQuery,
  useGetExpenseByIdQuery,
  useLazyCheckDuplicateQuery,
  useGetTitleSuggestionsQuery,
} from "../redux/api/expense";
import type { DuplicateMatch } from "../redux/api/expense";
import {
  useGetGroupMembersQuery,
  useGetGroupByIdQuery,
} from "../redux/api/group";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { SplitEntry } from "../interface/expense";
import {
  useExpenseHandlers,
  updateSplitAmount,
  equalSplitAmounts,
} from "../handlers/useExpenseHandlers";
import type { ExpenseField } from "../handlers/useExpenseHandlers";
import {
  PageBackground,
  BackButton,
  Button,
  ErrorMessage,
  FormField,
  DatePicker,
  Chip,
  ChoiceGroup,
  Disclosure,
  Note,
  SegmentedToggle,
  Input,
  Textarea,
  Spinner,
  LimitMeter,
  PageContainer,
  PageHeader,
} from "../components/ui";
import DuplicateNoticeBar from "../components/ui/DuplicateNoticeBar";
import DuplicateExpenseModal from "../components/ui/DuplicateExpenseModal";
import {
  sanitizeAmount,
  MIN_DATE,
  todayISODate,
  validateTitle,
  validateAmount,
  validateDate,
} from "../helpers/validators";
import { addDays, toISODate } from "../helpers/date";
import {
  readExpenseDefaults,
  writeExpenseDefaults,
  clearExpenseDefaults,
} from "../helpers/expenseDefaults";
import { formatCents, limitStatus } from "../helpers/money";
import { groupTypeOf, noExpensesCopy } from "../helpers/groupTypes";
import { useFieldError } from "../hooks/useFieldError";
import { useTranslation } from "react-i18next";

/**
 * The genuinely rare sections, still collapsible inside step 2. Payment, payer
 * and split are not here: they are step 2's whole reason to exist, so they show
 * expanded. Absent = fall back to a computed default.
 */
type SectionKey = "credit" | "funded" | "note";

/**
 * Off / equal / custom, as one three-way choice.
 *
 * This replaced a Switch plus a buried "÷ Split Equally" link. Splitting evenly
 * is what almost everyone means by "split", so it is now a mode you pick rather
 * than a button you find after typing amounts by hand — and because the mode is
 * explicit, an equal split can follow the amount when the amount changes
 * instead of quietly going stale.
 */
type SplitMode = "off" | "equal" | "custom";

// Are these amounts an even division? Used once, to decide which mode an
// existing expense reopens in. splitEqually gives the rounding remainder to the
// first member, so an even split of ₹100 three ways is 33.34/33.33/33.33 — the
// test is a one-paisa spread, not exact equality.
const looksEqual = (splits: SplitEntry[]): boolean => {
  if (splits.length < 2) return true;
  const amounts = splits.map((s) => s.amount || 0);
  return Math.max(...amounts) - Math.min(...amounts) <= 0.01;
};

export default function CreateExpensePage() {
  const { groupId, expenseId } = useParams<{
    groupId: string;
    expenseId?: string;
  }>();
  const isEdit = !!expenseId;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { userId } = useCurrentUser();
  const currentUserId = userId ?? undefined;
  const { data: paymentTypes = [], isLoading: pmLoading } =
    useGetPaymentMethodQuery();
  const { data: categories = [], isLoading: catLoading } =
    useGetCategoriesQuery(groupId!, { skip: !groupId });
  const { data: creditCategories = [], isLoading: creditCatLoading } =
    useGetCreditCategoriesQuery(groupId!, { skip: !groupId });
  const { data: groupMembers = [], isLoading: membersLoading } =
    useGetGroupMembersQuery(groupId!, { skip: !groupId });
  const { data: groupDetails } = useGetGroupByIdQuery(groupId!, {
    skip: !groupId,
  });
  const { data: groupLinks } = useGetGroupLinksQuery(groupId!, {
    skip: !groupId,
  });
  // Reserve and Chit groups hold funds rather than spending them — a Reserve on
  // behalf of the groups it bankrolls, a Chit on behalf of the next member in the
  // rotation. `features` is resolved server-side; default to allowed while the
  // group is still loading so the form never flickers into the blocked state for
  // a group that records expenses perfectly well.
  const blockNewExpense = !isEdit && groupDetails?.features?.expenses === false;
  // Which of the two refused, so the screen below can say why. Resolved the same
  // way useGroupType does, off the payload already in hand.
  const blockedCopy = noExpensesCopy(groupDetails?.groupTypeName ?? groupTypeOf(groupDetails?.purpose));
  const { data: editExpense } = useGetExpenseByIdQuery(
    { groupId: groupId!, expenseId: expenseId! },
    { skip: !isEdit || !groupId },
  );
  // Only fetched for a new expense: when editing, the title is already known and
  // a row of "did you mean" chips under a filled field is just noise.
  const { data: titleSuggestions = [] } = useGetTitleSuggestionsQuery(
    { groupId: groupId!, limit: 4 },
    { skip: !groupId || isEdit },
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

  /**
   * Step 2 as it was left on the last expense saved in this group.
   *
   * Read once, in a lazy initializer, so the localStorage hit does not repeat
   * every render. Never applied raw — ids are checked against the live member,
   * category and funder lists first, since a remembered payer may have left the
   * group since.
   */
  const [remembered] = useState(() =>
    groupId && !isEdit ? readExpenseDefaults(groupId) : null,
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISODate);
  const [categoryId, setCategoryId] = useState("");
  const [creditCategoryId, setCreditCategoryId] = useState("");
  // "" means the group's own wallet — the default, and the only option when
  // nothing funds this group. A remembered funder is only honoured once it is
  // confirmed to still be an active one; see fundedByGroupSafe below.
  const [fundedByGroup, setFundedByGroup] = useState(
    () => remembered?.fundedByGroup ?? "",
  );
  const [paymentType, setPaymentType] = useState(
    () => remembered?.paymentType ?? "Cash",
  );
  const [paidBy, setPaidBy] = useState("");
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>("off");
  const [openSections, setOpenSections] = useState<
    Partial<Record<SectionKey, boolean>>
  >({});
  const [step, setStep] = useState<1 | 2>(1);
  const [defaultsCleared, setDefaultsCleared] = useState(false);
  const { fieldErrors, setFieldError, clearFieldError } =
    useFieldError<ExpenseField>();
  const [apiError, setApiError] = useState("");

  const splitEnabled = splitMode !== "off";

  const [trigger, { data: dupData, isFetching: dupChecking }] =
    useLazyCheckDuplicateQuery();
  const [dupTier, setDupTier] = useState<1 | 2 | null>(null);
  const [dupMatch, setDupMatch] = useState<DuplicateMatch | null>(null);
  const [dupModalOpen, setDupModalOpen] = useState(false);
  const [dupDismissed, setDupDismissed] = useState(false);
  const dupBypassRef = useRef(false);
  // Set by step 1's "save with defaults" shortcut so the shared onSubmit knows
  // to fall through to the real submit instead of advancing a step. A ref, not
  // state: it must be readable in the very next submit without a re-render.
  const saveFromStep1Ref = useRef(false);
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
    setDupDismissed(false);

    if (!totalAmount || !date || !groupId) return;

    debounceRef.current = setTimeout(() => {
      trigger({
        groupId,
        // RUPEES — see DuplicateCheckParams.amount. Mongoose runs the schema's
        // toDBAmount setter on equality filters, so the server must be sent
        // display units and converts them itself.
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

  // Process API response. Both tiers render the same inline notice; the tier-2
  // modal is NOT opened here. It used to be, which meant a confirm dialog could
  // interrupt you mid-keystroke. It now waits for the submit handler below, so
  // the question is asked at the moment you actually commit.
  useEffect(() => {
    if (!dupData) return;
    setDupTier(dupData.tier);
    setDupMatch(dupData.match);
  }, [dupData]);

  const handleDupConfirm = () => {
    setDupModalOpen(false);
    dupBypassRef.current = true;
    // "Add Anyway" must mean add. The modal can be reached from step 1 via the
    // save shortcut, so this flag has to be re-armed or the resubmit below
    // would advance a step instead of saving.
    saveFromStep1Ref.current = true;
    setDupTier(null);
    setDupMatch(null);
    // The submit that opened this modal was cancelled, so re-fire it now that
    // the bypass flag is set.
    formRef.current?.requestSubmit();
  };

  const handleDupCancel = () => {
    setDupModalOpen(false);
    setDupTier(null);
    setDupMatch(null);
    navigate(-1);
  };

  const splitTotal = parseFloat(
    splits.reduce((s, e) => s + (e.amount || 0), 0).toFixed(2),
  );
  const splitDiff = parseFloat((totalAmount - splitTotal).toFixed(2));
  const splitValid = splitDiff === 0;
  // Only custom amounts can go stale — an equal split is re-derived below
  // whenever the amount or the member list moves.
  const splitStale =
    splitMode === "custom" &&
    splits.length > 0 &&
    totalAmount > 0 &&
    !splitValid;

  // Quick date presets. LOCAL time, via the helpers/date rule — the `max` below
  // is todayISODate() which is local, while these two used to be derived from
  // toISOString() which is UTC. East of Greenwich those disagree until the UTC
  // day catches up, so before ~05:30 IST the form opened on yesterday.
  const todayISO = todayISODate();
  const yesterdayISO = toISODate(addDays(new Date(), -1));

  // Reserve groups giving this group credit — the only valid choices for
  // "Pay with". Picking one charges the expense to that Reserve like a card.
  const funders = (groupLinks?.incoming ?? [])
    .filter((l) => l.status === "ACTIVE")
    .map((l) => {
      const src = l.sourceGroupId;
      const creditLimit = l.creditLimit ?? 0;
      const outstanding = l.outstanding ?? 0;
      return {
        id: typeof src === "string" ? src : src._id,
        name: typeof src === "string" ? src : src.name,
        creditLimit,
        available: Math.max(0, creditLimit - outstanding),
      };
    });

  /* How an expense was paid is fixed once it exists (the API refuses a
     change), so in edit mode the stored choice wins even if its credit line
     has since been closed. For a new expense a remembered funder is only
     honoured while it is still an active one. Derived rather than set in an
     effect, so the fallback is instant. This is what gets submitted. */
  const editFunderId = isEdit ? (editExpense?.fundedByGroup?._id ?? "") : "";
  const editWasOnCredit = isEdit && Boolean(editExpense?.creditLink);
  const fundedByGroupSafe = isEdit
    ? editFunderId
    : fundedByGroup && funders.some((f) => f.id === fundedByGroup)
      ? fundedByGroup
      : "";
  const selectedFunder = funders.find((f) => f.id === fundedByGroupSafe);
  const payingOnCredit = isEdit ? editWasOnCredit : Boolean(selectedFunder);

  // The most this expense may be. On credit that is the credit still free
  // (plus, when editing, what this expense already holds on the line);
  // otherwise the wallet, exactly as before.
  const creditCap = payingOnCredit
    ? (selectedFunder?.available ?? 0) + (editWasOnCredit ? editOldAmount : 0)
    : 0;
  const spendCap = payingOnCredit ? creditCap : effectiveBalance;

  // Balance hint coloring
  const amountIsNearLimit =
    totalAmount > 0 &&
    spendCap > 0 &&
    totalAmount / spendCap > 0.8;

  // Categories sorted by most used
  const sortedCategories = [...categories].sort(
    (a, b) => b.expenseCount - a.expenseCount,
  );

  // ── Category spend limit ──────────────────────────────────────────
  // A soft, group-wide cap on the chosen category. Crossing it warns and
  // nothing more — the submit path is untouched.
  const selectedCategory = categories.find((c) => c._id === categoryId);
  // When editing, this expense's own amount is already inside the category's
  // spent total, so take it back out before adding the new amount — otherwise
  // an untouched edit reads as double the spend. Only applies while the expense
  // stays in the category it was filed under.
  const editingSameCategory =
    isEdit && editExpense?.category?._id === categoryId;
  const alreadySpentCents = Math.max(
    (selectedCategory?.spentCents ?? 0) -
      (editingSameCategory ? Math.round(editOldAmount * 100) : 0),
    0,
  );
  const projectedSpentCents = alreadySpentCents + Math.round(totalAmount * 100);
  const categoryLimitCents = selectedCategory?.limitCents ?? null;
  const limitInfo = limitStatus(projectedSpentCents, categoryLimitCents);
  const overLimit = limitInfo?.state === "over";

  /* A remembered payment type can have been dropped from the enum. Validated
     by derivation rather than by another effect, so the fallback is instant
     and there is no extra render. */
  const paymentTypeSafe =
    paymentTypes.length === 0 || paymentTypes.includes(paymentType)
      ? paymentType
      : (paymentTypes[0] ?? paymentType);

  // "All members in split" flag for Add All / Clear All
  const allMembersInSplit =
    groupMembers.length > 0 &&
    groupMembers.every((m) => splits.some((s) => s.userId === m.userId._id));

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
    if (editExpense.creditCategory?._id)
      setCreditCategoryId(editExpense.creditCategory._id);
    if (editExpense.fundedByGroup?._id)
      setFundedByGroup(editExpense.fundedByGroup._id);
    setPaymentType(editExpense.paymentType);
    setPaidBy(editExpense.paidBy._id);
    const editSplits = editExpense.splitBetween.map((s) => ({
      userId: s.userId._id,
      name: s.userId.name,
      amount: s.amount,
    }));
    setSplits(editSplits);
    // Reopening in "equal" only when the stored amounts actually are even —
    // otherwise a later amount change would silently overwrite hand-entered
    // numbers the user meant to keep.
    setSplitMode(
      editSplits.length === 0
        ? "off"
        : looksEqual(editSplits)
          ? "equal"
          : "custom",
    );
  }, [isEdit, editExpense]);

  // Auto-select first category (most used) when categories load
  useEffect(() => {
    if (isEdit) return;
    if (!catLoading && categories.length > 0 && !categoryId) {
      const sorted = [...categories].sort(
        (a, b) => b.expenseCount - a.expenseCount,
      );
      setCategoryId(sorted[0]._id);
    }
  }, [catLoading, categories.length, categoryId]);

  // Credit pool: last one used if it still exists, else the most-used. Backend
  // already returns credit categories sorted by usage (most-used first).
  useEffect(() => {
    if (isEdit) return;
    if (!creditCatLoading && creditCategories.length > 0 && !creditCategoryId) {
      const kept = creditCategories.find(
        (c) => c._id === remembered?.creditCategoryId,
      );
      setCreditCategoryId(kept?._id ?? creditCategories[0]._id);
    }
  }, [creditCatLoading, creditCategories.length, creditCategoryId, remembered]);

  /* ── Restore step 2 from the last expense ───────────────────────────────
     One effect, gated on members having arrived, because every remembered id
     has to be checked against the live list before it is applied — a payer who
     has left the group would otherwise be preselected and rejected on submit.
     Runs once; after that the user owns these fields. */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (isEdit || restoredRef.current) return;
    if (membersLoading || groupMembers.length === 0) return;
    restoredRef.current = true;

    const stillHere = (userId: string) =>
      groupMembers.some((m) => m.userId._id === userId);

    // Remembered payer, falling back to the signed-in user as before.
    const payer =
      remembered?.paidBy && stillHere(remembered.paidBy)
        ? remembered.paidBy
        : groupMembers.find((m) => m.userId._id === currentUserId)?.userId._id;
    if (payer) setPaidBy(payer);

    const ids = (remembered?.splitUserIds ?? []).filter(stillHere);
    const mode = remembered?.splitMode ?? "off";
    if (mode !== "off" && ids.length > 0) {
      // Amounts are not restored — they are re-derived from this expense's
      // amount, which is the only thing that could make them correct.
      const entries = ids.map((id) => ({
        userId: id,
        name: groupMembers.find((m) => m.userId._id === id)!.userId.name,
        amount: 0,
      }));
      // Restored at whatever the amount is right now — usually 0, since members
      // land before anything is typed. handleAmountChange re-divides from there.
      setSplits(
        mode === "equal" ? equalSplitAmounts(entries, totalAmount) : entries,
      );
      setSplitMode(mode);
    }
    // totalAmount is in the deps because it is read above, but restoredRef
    // makes every re-run after the first a no-op. Suppressing the rule instead
    // would opt this whole component out of the React Compiler.
  }, [
    isEdit,
    membersLoading,
    groupMembers,
    currentUserId,
    remembered,
    totalAmount,
  ]);

  /* ── Keeping an equal split equal ───────────────────────────────────────
     Re-derived inside the change handlers rather than by an effect watching
     totalAmount. An effect would be a setState-in-effect cascade, which this
     codebase deliberately avoids (see hooks/useRecentGroups.ts). The paise
     rounding itself lives in equalSplitAmounts, shared with splitEqually. */
  const handleAmountChange = (raw: string) => {
    const clean = sanitizeAmount(
      raw,
      spendCap > 0 ? spendCap : undefined,
    );
    setAmount(clean);
    clearFieldError("amount");
    if (splitMode === "equal" && splits.length > 0) {
      const next = parseFloat(parseFloat(clean || "0").toFixed(2)) || 0;
      setSplits((prev) => equalSplitAmounts(prev, next));
    }
  };

  const handleSplitModeChange = (mode: SplitMode) => {
    setSplitMode(mode);
    clearFieldError("splits");
    if (mode === "off") {
      setSplits([]);
      return;
    }
    // Entering a split with nobody picked means everybody — that is what the
    // old "Add All" button was for, and it is the only sensible starting point.
    const base =
      splits.length > 0
        ? splits
        : groupMembers.map((m) => ({
            userId: m.userId._id,
            name: m.userId.name,
            amount: 0,
          }));
    setSplits(mode === "equal" ? equalSplitAmounts(base, totalAmount) : base);
  };

  /**
   * `user` is the member's USER, not the GroupMember wrapper.
   *
   * splits[].userId holds a user id — that is what the API stores and what the
   * edit prefill maps back. The old chips mixed the two: they added
   * `member.userId._id` but tested selection and removal against `member._id`,
   * the membership document id, so a chip never lit up and a second tap
   * appended a duplicate instead of removing. One id, used everywhere.
   */
  const handleToggleMember = (user: { _id: string; name: string }) => {
    clearFieldError("splits");
    const isAdding = !splits.some((s) => s.userId === user._id);
    const next = isAdding
      ? [...splits, { userId: user._id, name: user.name, amount: 0 }]
      : splits.filter((s) => s.userId !== user._id);
    setSplits(
      splitMode === "equal" ? equalSplitAmounts(next, totalAmount) : next,
    );
  };

  /** Drop the remembered defaults and put step 2 back to a clean slate. */
  const forgetDefaults = () => {
    if (groupId) clearExpenseDefaults(groupId);
    setDefaultsCleared(true);
    setPaymentType("Cash");
    setPaidBy(
      groupMembers.find((m) => m.userId._id === currentUserId)?.userId._id ??
        "",
    );
    setSplitMode("off");
    setSplits([]);
    setFundedByGroup("");
    setCreditCategoryId(creditCategories[0]?._id ?? "");
  };

  /**
   * Remember step 2 for the next expense in this group. Called only after the
   * server has accepted the save, so a rejected attempt never poisons the
   * defaults. Amounts are not stored — only the shape of the decision.
   */
  const rememberStep2 = () => {
    if (!groupId || isEdit) return;
    writeExpenseDefaults(groupId, {
      paymentType: paymentTypeSafe,
      paidBy,
      splitMode,
      splitUserIds: splits.map((s) => s.userId),
      creditCategoryId,
      fundedByGroup: fundedByGroupSafe,
    });
  };

  /* ── Section open state ─────────────────────────────────────────────────
     `undefined` means the user has not touched the section, so it falls back
     to a computed default; once they toggle it, their choice wins. */
  const isOpen = (key: SectionKey, fallback: boolean) =>
    openSections[key] ?? fallback;
  const setOpen = (key: SectionKey) => (open: boolean) =>
    setOpenSections((prev) => ({ ...prev, [key]: open }));

  // Which step each field belongs to, so a submit-time error can send the user
  // back to the screen that actually contains the offending control.
  const STEP1_FIELDS: ExpenseField[] = ["title", "amount", "date", "category"];

  const setFieldErrorAndReveal = (field: ExpenseField, message: string) => {
    setFieldError(field, message);
    // Reached via the step-1 "save now" shortcut, or a server rejection: the
    // user must be looking at the control that is wrong.
    if (STEP1_FIELDS.includes(field)) setStep(1);
  };

  /**
   * Step 1 gate.
   *
   * Same validators the submit path uses, run early against only the four
   * fields this screen owns — so "Continue" cannot walk the user to step 2 and
   * then fail them on something they can no longer see.
   */
  const validateStep1 = (): boolean => {
    let ok = true;
    const titleV = validateTitle(title);
    if (!titleV.valid) {
      setFieldError("title", titleV.message);
      ok = false;
    }
    const amountV = validateAmount(totalAmount, spendCap);
    if (!amountV.valid) {
      setFieldError("amount", amountV.message);
      ok = false;
    }
    const dateV = validateDate(date);
    if (!dateV.valid) {
      setFieldError("date", dateV.message);
      ok = false;
    }
    if (!categoryId) {
      setFieldError("category", "Select a category");
      ok = false;
    }
    return ok;
  };

  const goToStep = (next: 1 | 2) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  // Silent version of the same four checks — drives whether the "save now"
  // shortcut is offered, without writing errors to a form the user is still
  // filling in.
  const step1Complete =
    validateTitle(title).valid &&
    validateAmount(totalAmount, spendCap).valid &&
    validateDate(date).valid &&
    Boolean(categoryId);

  const selectedCreditCategory = creditCategories.find(
    (c) => c._id === creditCategoryId,
  );

  const splitSummary =
    splitMode === "off"
      ? t("createExpense.splitOff", "Not split")
      : splitStale
        ? t("createExpense.splitNeedsAttention", "Needs attention")
        : splitMode === "equal"
          ? t(
              "createExpense.splitEquallyBetween",
              "Equally between {{count}}",
              { count: splits.length },
            )
          : t(
              "createExpense.splitCustomOf",
              "Custom · ₹{{total}} of ₹{{amount}}",
              {
                total: splitTotal.toLocaleString("en-IN"),
                amount: totalAmount.toLocaleString("en-IN"),
              },
            );

  const memberSkeletons = (count: number, width: (i: number) => number) => (
    <div className="flex flex-wrap gap-2" aria-busy="true">
      <span className="sr-only">{t("common.loading", "Loading…")}</span>
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="h-11 rounded-full bg-surface-hover animate-pulse"
          style={{ width: `${width(i)}px`, animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );

  const avatarFor = (name: string, selected: boolean) => (
    <span
      className={`w-7 h-7 rounded-full flex items-center justify-center text-theme-2xs font-bold shrink-0 ${
        selected
          ? "bg-brand-500/25 text-brand-700 dark:text-brand-300"
          : "bg-surface-hover text-fg-muted"
      }`}
      translate="no"
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );

  // A Reserve or Chit group records no expenses. Guarded on the page itself, not
  // only on the affordances that lead here, because this route is also reachable
  // by deep link and by the global keyboard shortcut — and the API would refuse
  // the save anyway, so the form must not pretend otherwise.
  //
  // Creation only. Editing stays open: a group may already carry expenses from
  // before its type refused them, and they have to remain correctable.
  if (blockNewExpense) {
    return (
      <div className="min-h-screen bg-surface text-fg">
        <PageBackground />
        <PageContainer width="form">
          <PageHeader
            accent="warning"
            icon={
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M7 1.5 12.5 12H1.5L7 1.5ZM7 5.5v3M7 10.2v.3"
                  stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            }
            label={t(blockedCopy.labelKey, blockedCopy.label)}
            title={t(blockedCopy.titleKey, blockedCopy.title)}
            description={t(blockedCopy.messageKey, blockedCopy.message)}
          />
          <Button variant="secondary" onClick={() => navigate(`/groups/${groupId}`)}>
            {t("createExpense.reserveAction", "Back to group")}
          </Button>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />

      <PageContainer
        ref={formRef}
        onSubmit={(e) => {
          // Step 1 owns Enter-to-advance as well as its Continue button, so a
          // stray Enter in the title field moves on rather than saving a
          // half-filled expense.
          if (step === 1 && !saveFromStep1Ref.current) {
            e.preventDefault();
            if (validateStep1()) goToStep(2);
            return;
          }
          saveFromStep1Ref.current = false;

          if (dupTier === 2 && dupMatch && !dupBypassRef.current) {
            e.preventDefault();
            setDupModalOpen(true);
            return;
          }
          dupBypassRef.current = false;
          handleSubmit(e, {
            title,
            description,
            totalAmount,
            maxAmount: spendCap,
            categoryId,
            creditCategoryId: creditCategoryId || undefined,
            fundedByGroup: fundedByGroupSafe || undefined,
            paidBy,
            splits,
            splitValid,
            splitEnabled,
            date,
            paymentType: paymentTypeSafe,
            setFieldError: setFieldErrorAndReveal,
            setApiError,
            onSaved: rememberStep2,
          });
        }}
        width="form"
        gap="sm"
        as="form"
      >
        <BackButton />

        {/* The old PageHeader — icon chip, eyebrow, title, description — cost
            most of a phone screen before the first field on the app's most
            repeated task. A heading and the step counter is enough. */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-title-sm font-semibold tracking-tight text-fg">
              {isEdit
                ? t("editExpense.title", "Edit Expense")
                : t("createExpense.title")}
            </h1>
            <span
              className="shrink-0 text-theme-2xs font-semibold uppercase tracking-widest text-fg-muted"
              translate="no"
            >
              {t("createExpense.stepCounter", "Step {{step}} of 2", { step })}
            </span>
          </div>

          {/* Two bars rather than numbered dots: the label below already names
              the step, and a filled bar reads as progress at a glance. */}
          <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2].map((n) => (
              <span
                key={n}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  n <= step ? "bg-brand-500" : "bg-line"
                }`}
              />
            ))}
          </div>

          <p className="text-theme-xs text-fg-muted">
            {step === 1
              ? t(
                  "createExpense.step1Hint",
                  "The essentials — amount, what it was for, and which category.",
                )
              : t(
                  "createExpense.step2Hint",
                  "Payment, who it was for, and anything optional.",
                )}
          </p>
        </div>

        {/* Both steps see this: the match was found from step 1's fields, but
            the confirm happens at save on step 2. */}
        {dupTier && dupMatch && !dupDismissed && (
          <DuplicateNoticeBar
            match={dupMatch}
            onDismiss={() => setDupDismissed(true)}
          />
        )}

        {step === 1 && (
          <>
            {/* ── The core: what it cost, what it was, when ─────────────────── */}
            <div className="rounded-2xl border border-line bg-surface-raised shadow-theme-xs px-5 sm:px-6 py-5 space-y-4">
              <FormField
                label={t("createExpense.amount")}
                required
                error={fieldErrors.amount}
              >
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10
                  text-theme-xl font-semibold text-fg-subtle"
                    aria-hidden="true"
                  >
                    ₹
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="!pl-9 !py-3 !text-theme-xl !font-semibold"
                  />
                </div>
              </FormField>

              {payingOnCredit ? (
                creditCap > 0 ? (
                  <p
                    className={`-mt-2 text-theme-2xs font-medium transition-colors ${
                      amountIsNearLimit
                        ? "text-warning-700 dark:text-warning-400"
                        : "text-fg-muted"
                    }`}
                    translate="no"
                  >
                    {t("createExpense.creditAvailable", {
                      amount: creditCap.toLocaleString("en-IN"),
                      group: selectedFunder?.name ?? editExpense?.fundedByGroup?.name ?? "",
                      defaultValue: "Reserve credit available: ₹{{amount}} from {{group}}",
                    })}
                  </p>
                ) : (
                  <Note tone="warning" className="-mt-2">
                    {t(
                      "createExpense.noCreditLeft",
                      "No Reserve credit is left on this line. Repay some on the Connections page, or ask the Reserve to raise the limit.",
                    )}
                  </Note>
                )
              ) : effectiveBalance > 0 ? (
                <p
                  className={`-mt-2 text-theme-2xs font-medium transition-colors ${
                    amountIsNearLimit
                      ? "text-warning-700 dark:text-warning-400"
                      : "text-fg-muted"
                  }`}
                  translate="no"
                >
                  {isEdit && editOldAmount > 0
                    ? t("createExpense.groupBalanceEdit", {
                        amount: effectiveBalance.toLocaleString("en-IN"),
                        wallet: groupBalance.toLocaleString("en-IN"),
                        refund: editOldAmount.toLocaleString("en-IN"),
                        defaultValue:
                          "Balance: ₹{{amount}} — ₹{{wallet}} in the wallet plus the ₹{{refund}} this expense gets back when you save.",
                      })
                    : t("createExpense.groupBalance", {
                        amount: effectiveBalance.toLocaleString("en-IN"),
                      })}
                </p>
              ) : (
                <Note tone="warning" className="-mt-2">
                  {t(
                    "createExpense.emptyWallet",
                    "This group's wallet is empty, so an amount can't be entered yet. Add funds first.",
                  )}
                </Note>
              )}

              {/* An equal split follows the amount on its own, so this only ever
              fires for hand-entered amounts — where silently rewriting them
              would be the wrong call, and a one-tap fix is the right one. */}
              {splitStale && (
                <Note
                  tone="warning"
                  className="-mt-2"
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        clearFieldError("splits");
                        setSplitMode("equal");
                        setSplits((prev) =>
                          equalSplitAmounts(prev, totalAmount),
                        );
                      }}
                      className="shrink-0 font-semibold underline underline-offset-2
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded"
                    >
                      {t("createExpense.resplitEqually", "Re-split equally")}
                    </button>
                  }
                >
                  <span translate="no">
                    {t("createExpense.splitOutOfSync", {
                      total: splitTotal.toLocaleString("en-IN"),
                      amount: totalAmount.toLocaleString("en-IN"),
                      defaultValue:
                        "The split still adds up to ₹{{total}}, not ₹{{amount}}.",
                    })}
                  </span>
                </Note>
              )}

              <FormField
                label={t("createExpense.titleLabel")}
                required
                error={fieldErrors.title}
                hint={title.length > 80 ? `${title.length}/100` : undefined}
              >
                <Input
                  type="text"
                  autoComplete="off"
                  maxLength={100}
                  placeholder={t("createExpense.titlePlaceholder")}
                  value={title}
                  onChange={(e) => {
                    clearFieldError("title");
                    setTitle(e.target.value);
                  }}
                />
              </FormField>

              {/* Rent, groceries and the weekly team lunch get retyped verbatim
              every time. Only offered while the field is empty. */}
              {!title && titleSuggestions.length > 0 && (
                <ChoiceGroup
                  label={t("createExpense.suggestionsLabel", "Used before")}
                  className="-mt-1"
                >
                  {titleSuggestions.map((s) => (
                    <Chip
                      key={s.title}
                      variant="choice"
                      check={false}
                      onClick={() => {
                        clearFieldError("title");
                        setTitle(s.title);
                        // The category it is usually filed under is most of the
                        // time saved here, so take that too.
                        if (
                          s.categoryId &&
                          categories.some((c) => c._id === s.categoryId)
                        ) {
                          clearFieldError("category");
                          setCategoryId(s.categoryId);
                        }
                      }}
                    >
                      <span translate="no">{s.title}</span>
                    </Chip>
                  ))}
                </ChoiceGroup>
              )}

              <FormField
                label={t("createExpense.date")}
                error={fieldErrors.date}
              >
                <DatePicker
                  value={date}
                  onChange={(v) => {
                    clearFieldError("date");
                    setDate(v);
                  }}
                  min={MIN_DATE}
                  max={todayISODate()}
                />
              </FormField>

              <div className="-mt-2 flex gap-1.5">
                {[
                  { label: t("createExpense.today"), value: todayISO },
                  { label: t("createExpense.yesterday"), value: yesterdayISO },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      clearFieldError("date");
                      setDate(preset.value);
                    }}
                    aria-pressed={date === preset.value}
                    className={`px-2 py-1 rounded-md text-theme-2xs font-semibold transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                    date === preset.value
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-fg-muted hover:text-fg"
                  }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Reserved height: the notice bar replacing this line must not
              shove the rest of the form down as you type. */}
              <div className="min-h-[18px]" role="status" aria-live="polite">
                {dupChecking && (
                  <span className="inline-flex items-center gap-1.5 text-theme-2xs text-fg-muted">
                    <Spinner size={11} />
                    {t(
                      "createExpense.checkingDuplicates",
                      "Checking for duplicates…",
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* ── Category: required, so it shares step 1 ───────────────────── */}
            <div className="rounded-2xl border border-line bg-surface-raised shadow-theme-xs px-5 sm:px-6 py-5 space-y-3">
              <ChoiceGroup
                label={t("createExpense.category")}
                error={fieldErrors.category}
              >
                {catLoading ? (
                  <div className="flex flex-wrap gap-2" aria-busy="true">
                    <span className="sr-only">
                      {t("common.loading", "Loading…")}
                    </span>
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="h-11 rounded-xl bg-surface-hover animate-pulse"
                        style={{
                          width: `${64 + i * 16}px`,
                          animationDelay: `${i * 80}ms`,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    {sortedCategories.map((cat) => (
                      <Chip
                        key={cat._id}
                        variant="choice"
                        selected={categoryId === cat._id}
                        accentColor={cat.color}
                        onClick={() => {
                          clearFieldError("category");
                          setCategoryId(cat._id);
                        }}
                      >
                        <span translate="no">{cat.name}</span>
                      </Chip>
                    ))}
                    {isAdmin ? (
                      <Chip
                        variant="choice"
                        dashed
                        onClick={() =>
                          navigate(`/groups/${groupId}/categories/new`)
                        }
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M5 1v8M1 5h8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        {categories.length === 0
                          ? t("createExpense.noCategoriesCreate")
                          : t("createExpense.add")}
                      </Chip>
                    ) : categories.length === 0 ? (
                      <span className="text-theme-xs text-fg-muted px-1 py-1.5">
                        {t(
                          "createExpense.noCategoriesMember",
                          "No categories yet — ask an admin to add one.",
                        )}
                      </span>
                    ) : null}
                  </>
                )}
              </ChoiceGroup>

              {/* Spend limit for the chosen category, projected to include the
              amount being typed — so the bar turns amber/red as you type. */}
              {selectedCategory && categoryLimitCents ? (
                <div className="rounded-xl border border-line bg-surface px-3.5 py-3 space-y-1.5">
                  <p className="text-theme-2xs font-medium text-fg-muted">
                    {t("createExpense.limitFor", "{{name}} limit", {
                      name: selectedCategory.name,
                    })}
                  </p>
                  <LimitMeter
                    spentCents={projectedSpentCents}
                    limitCents={categoryLimitCents}
                  />
                  {totalAmount > 0 && (
                    <p className="text-theme-2xs text-fg-muted" translate="no">
                      {t(
                        "createExpense.limitIncludesThis",
                        "Includes this {{amount}} · {{spent}} spent so far",
                        {
                          amount: formatCents(
                            Math.round(totalAmount * 100),
                            i18n.language,
                          ),
                          spent: formatCents(alreadySpentCents, i18n.language),
                        },
                      )}
                    </p>
                  )}
                  {/* The meter above already went red. This used to be a second,
                  page-wide bordered card with a warning triangle, which read as
                  "blocked" while its own last line said the opposite. */}
                  {overLimit && limitInfo && (
                    <Note tone="warning" translate="no">
                      {t(
                        "createExpense.overLimitLine",
                        "This takes {{name}} to {{projected}} against a {{limit}} limit — {{over}} over.",
                        {
                          name: selectedCategory.name,
                          projected: formatCents(
                            projectedSpentCents,
                            i18n.language,
                          ),
                          limit: formatCents(
                            limitInfo.limitCents,
                            i18n.language,
                          ),
                          over: formatCents(
                            Math.abs(limitInfo.remainingCents),
                            i18n.language,
                          ),
                        },
                      )}{" "}
                      <span className="text-fg-muted">
                        {t(
                          "createExpense.overLimitHint",
                          "You can still save it — this is only a heads-up.",
                        )}
                      </span>
                    </Note>
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* Prefilling silently would be spooky, and unexplained wrong defaults
            are worse than no defaults. Say it, and offer the way out. */}
            {remembered && !defaultsCleared && (
              <Note
                tone="neutral"
                action={
                  <button
                    type="button"
                    onClick={forgetDefaults}
                    className="shrink-0 font-semibold underline underline-offset-2 hover:text-fg
                  transition-colors rounded
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                  >
                    {t("createExpense.resetDefaults", "Reset")}
                  </button>
                }
              >
                {t(
                  "createExpense.rememberedNote",
                  "Filled in from your last expense in this group.",
                )}
              </Note>
            )}

            {/* ── Payment and payer: the reason you came to step 2 ──────────── */}
            <div className="rounded-2xl border border-line bg-surface-raised shadow-theme-xs px-5 sm:px-6 py-5 space-y-4">
              <h2 className="text-theme-xs font-semibold uppercase tracking-widest text-fg-muted">
                {t("createExpense.paymentSection", "Payment")}
              </h2>

              <ChoiceGroup
                label={t("createExpense.paymentType")}
                layout="grid"
                itemsClass="grid-cols-2 xsm:grid-cols-3 sm:grid-cols-4"
              >
                {pmLoading
                  ? [...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="h-14 rounded-xl bg-surface-hover animate-pulse"
                        style={{ animationDelay: `${i * 80}ms` }}
                        aria-busy="true"
                      />
                    ))
                  : paymentTypes?.map((pt) => (
                      <Chip
                        key={pt}
                        variant="tile"
                        selected={paymentTypeSafe === pt}
                        onClick={() => setPaymentType(pt)}
                      >
                        <span translate="no">{pt}</span>
                      </Chip>
                    ))}
              </ChoiceGroup>

              <ChoiceGroup
                label={t("createExpense.paidBy")}
                error={fieldErrors.paidBy}
              >
                {membersLoading
                  ? memberSkeletons(3, (i) => 88 + i * 20)
                  : groupMembers?.map((member) => {
                      const selected = paidBy === member.userId._id;
                      return (
                        <Chip
                          key={member.userId._id}
                          variant="avatar"
                          selected={selected}
                          onClick={() => {
                            clearFieldError("paidBy");
                            setPaidBy(member.userId._id);
                          }}
                        >
                          {avatarFor(member.userId.name, selected)}
                          <span translate="no">{member.userId?.name}</span>
                        </Chip>
                      );
                    })}
              </ChoiceGroup>
            </div>

            {/* ── Split ─────────────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-line bg-surface-raised shadow-theme-xs px-5 sm:px-6 py-5 space-y-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-theme-xs font-semibold uppercase tracking-widest text-fg-muted">
                  {t("createExpense.splitBetween")}
                </h2>
                <span className="text-theme-2xs text-fg-muted truncate">
                  {splitSummary}
                </span>
              </div>

              <SegmentedToggle<SplitMode>
                ariaLabel={t("createExpense.splitMode", "How to split")}
                value={splitMode}
                onChange={handleSplitModeChange}
                options={[
                  {
                    value: "off",
                    label: t("createExpense.splitOff", "Not split"),
                  },
                  {
                    value: "equal",
                    label: t("createExpense.splitEqualMode", "Equally"),
                  },
                  {
                    value: "custom",
                    label: t("createExpense.splitCustomMode", "Custom"),
                  },
                ]}
              />

              {splitEnabled && (
                <>
                  <ChoiceGroup
                    label={t("createExpense.splitWho", "Between")}
                    error={fieldErrors.splits}
                  >
                    {membersLoading
                      ? memberSkeletons(3, (i) => 88 + i * 20)
                      : groupMembers?.map((member) => {
                          const selected = splits.some(
                            (s) => s.userId === member.userId._id,
                          );
                          return (
                            <Chip
                              key={member.userId._id}
                              variant="avatar"
                              selected={selected}
                              onClick={() => handleToggleMember(member.userId)}
                            >
                              {avatarFor(member.userId.name, selected)}
                              <span translate="no">{member.userId?.name}</span>
                            </Chip>
                          );
                        })}
                  </ChoiceGroup>

                  {!membersLoading &&
                    groupMembers.length > 0 &&
                    !allMembersInSplit && (
                      <button
                        type="button"
                        onClick={() => {
                          clearFieldError("splits");
                          const all = groupMembers.map((m) => ({
                            userId: m.userId._id,
                            name: m.userId.name,
                            amount: 0,
                          }));
                          setSplits(
                            splitMode === "equal"
                              ? equalSplitAmounts(all, totalAmount)
                              : all,
                          );
                        }}
                        className="text-theme-2xs font-semibold text-brand-600 dark:text-brand-400
                    hover:text-brand-700 dark:hover:text-brand-300 transition-colors
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded"
                      >
                        {t("createExpense.addAllMembers", "Add everyone")}
                      </button>
                    )}

                  {splitMode === "custom" && splits.length > 0 && (
                    <div className="space-y-2">
                      {splits.map((split) => (
                        <div
                          key={split.userId}
                          className="flex items-center gap-3 bg-surface border border-line rounded-xl px-4 py-2.5"
                        >
                          <span
                            className="w-7 h-7 rounded-full bg-brand-50 border border-brand-200 dark:bg-brand-500/15 dark:border-brand-500/20 flex items-center justify-center text-theme-2xs font-bold text-brand-600 dark:text-brand-400 shrink-0"
                            translate="no"
                          >
                            {split.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span
                            className="flex-1 text-theme-sm font-medium text-fg truncate"
                            translate="no"
                          >
                            {split.name}
                          </span>
                          <div className="relative">
                            <span
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted text-theme-xs z-10"
                              aria-hidden="true"
                            >
                              ₹
                            </span>
                            <Input
                              size="sm"
                              className="w-24 !pl-6 text-right"
                              placeholder="0"
                              type="text"
                              value={split.amount || ""}
                              inputMode="decimal"
                              // Every row used to share one "Split total" label, so
                              // a screen reader heard the same field N times.
                              aria-label={t(
                                "createExpense.splitAmountFor",
                                "Split amount for {{name}}",
                                {
                                  name: split.name,
                                },
                              )}
                              onChange={(e) =>
                                updateSplitAmount(
                                  setSplits,
                                  split.userId,
                                  Number(
                                    sanitizeAmount(e.target.value, totalAmount),
                                  ),
                                )
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {splits.length > 0 && (
                    <div
                      className="flex items-center justify-between gap-2 px-1"
                      role="status"
                      aria-live="polite"
                    >
                      <span className="text-theme-2xs uppercase tracking-widest text-fg-muted">
                        {splitMode === "equal" && totalAmount > 0
                          ? t("createExpense.eachAmount", "{{amount}} each", {
                              amount: formatCents(
                                Math.round((totalAmount * 100) / splits.length),
                                i18n.language,
                              ),
                            })
                          : t("createExpense.splitTotal")}
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`text-theme-xs font-mono font-semibold ${
                            splitValid
                              ? "text-success-700 dark:text-success-400"
                              : "text-error-600 dark:text-error-400"
                          }`}
                          translate="no"
                        >
                          ₹{splitTotal.toLocaleString("en-IN")}
                        </span>
                        <span className="text-fg-muted text-theme-2xs">/</span>
                        <span
                          className="text-theme-xs font-mono text-fg-muted"
                          translate="no"
                        >
                          ₹{totalAmount.toLocaleString("en-IN")}
                        </span>
                        {splitValid ? (
                          <span className="text-success-700 dark:text-success-400">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        ) : (
                          <span
                            className="text-theme-2xs font-semibold text-error-600 dark:text-error-400"
                            translate="no"
                          >
                            {splitDiff > 0
                              ? t("createExpense.left", {
                                  amount: splitDiff.toFixed(2),
                                })
                              : t("createExpense.over", {
                                  amount: Math.abs(splitDiff).toFixed(2),
                                })}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {creditCategories.length > 0 && (
              <Disclosure
                title={t("createExpense.creditCategory", "Credit pool")}
                summary={
                  <span translate="no">
                    {selectedCreditCategory?.name ?? "—"}
                  </span>
                }
                open={isOpen("credit", false)}
                onOpenChange={setOpen("credit")}
              >
                <ChoiceGroup
                  label={t("createExpense.creditCategory", "Credit pool")}
                >
                  {creditCatLoading
                    ? memberSkeletons(3, (i) => 72 + i * 16)
                    : creditCategories.map((cat) => (
                        <Chip
                          key={cat._id}
                          variant="choice"
                          selected={creditCategoryId === cat._id}
                          accentColor={cat.color}
                          onClick={() => setCreditCategoryId(cat._id)}
                        >
                          <span translate="no">{cat.name}</span>
                        </Chip>
                      ))}
                </ChoiceGroup>
              </Disclosure>
            )}

            {/* Which wallet pays. A Reserve works like a credit card: picking
            one charges the expense to its wallet and adds it to what this
            group owes, instead of spending this group's own balance. */}
            {(funders.length > 0 || editWasOnCredit) && (
              <Disclosure
                title={t("createExpense.payWith", "Pay with")}
                summary={
                  <span translate="no">
                    {payingOnCredit
                      ? t("createExpense.reserveCredit", {
                          group: selectedFunder?.name ?? editExpense?.fundedByGroup?.name ?? "",
                          defaultValue: "{{group}} credit",
                        })
                      : t("createExpense.ownWallet", "This group's wallet")}
                  </span>
                }
                open={isOpen("funded", false)}
                onOpenChange={setOpen("funded")}
                contentClass="px-5 sm:px-6 pb-5 pt-1 space-y-2"
              >
                {isEdit ? (
                  <Note tone="info">
                    {t(
                      "createExpense.payWithLocked",
                      "How an expense was paid can't be changed. To pay another way, delete it and record it again.",
                    )}
                  </Note>
                ) : (
                  <ChoiceGroup label={t("createExpense.payWith", "Pay with")}>
                    <Chip
                      variant="choice"
                      selected={fundedByGroupSafe === ""}
                      onClick={() => setFundedByGroup("")}
                    >
                      {t("createExpense.ownWallet", "This group's wallet")}
                    </Chip>
                    {funders.map((f) => (
                      <Chip
                        key={f.id}
                        variant="choice"
                        selected={fundedByGroupSafe === f.id}
                        onClick={() => setFundedByGroup(f.id)}
                      >
                        <span translate="no">
                          {t("createExpense.reserveCreditChip", {
                            group: f.name,
                            amount: f.available.toLocaleString("en-IN"),
                            defaultValue: "{{group}} credit · ₹{{amount}} left",
                          })}
                        </span>
                      </Chip>
                    ))}
                  </ChoiceGroup>
                )}
              </Disclosure>
            )}

            <Disclosure
              title={t("createExpense.descriptionLabel")}
              summary={
                description ? (
                  <span translate="no">{description}</span>
                ) : (
                  t("createExpense.optional")
                )
              }
              open={isOpen("note", Boolean(description))}
              onOpenChange={setOpen("note")}
            >
              <FormField
                label={t("createExpense.descriptionLabel")}
                hint={
                  description.length > 400
                    ? `${description.length}/500`
                    : undefined
                }
              >
                <Textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("createExpense.descriptionPlaceholder")}
                  maxLength={500}
                />
              </FormField>
            </Disclosure>
          </>
        )}

        <ErrorMessage error={apiError} />

        {step === 1 ? (
          <div className="space-y-2 pt-1">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 py-3"
                onClick={() => navigate(-1)}
              >
                {t("deleteModal.cancel")}
              </Button>
              <Button type="submit" className="flex-1 py-3">
                {t("createExpense.continue", "Continue")}
              </Button>
            </div>

            {/* Step 2 is entirely defaults — Cash, paid by you, no split — so
                the everyday expense should not have to visit it. Offered only
                once step 1 is actually complete, so it never becomes a way to
                submit a half-filled form. */}
            {step1Complete && (
              <button
                type="button"
                onClick={() => {
                  saveFromStep1Ref.current = true;
                  formRef.current?.requestSubmit();
                }}
                disabled={isSubmitting}
                className="w-full py-2 text-theme-xs font-semibold text-fg-muted hover:text-fg
                  transition-colors rounded-lg disabled:opacity-50
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                {t(
                  "createExpense.saveWithDefaults",
                  "Save now with the defaults",
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 py-3"
              onClick={() => goToStep(1)}
            >
              {t("createExpense.back", "Back")}
            </Button>
            <Button
              type="submit"
              className="flex-1 py-3"
              loading={isSubmitting}
              loadingLabel={t("createExpense.saving")}
            >
              {isEdit
                ? t("editExpense.save", "Save changes")
                : t("createExpense.save")}
            </Button>
          </div>
        )}
      </PageContainer>

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
