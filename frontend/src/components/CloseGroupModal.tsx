import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetGroupClosePreviewQuery,
  useCloseGroupMutation,
} from "../redux/api/group";

interface Props {
  isOpen: boolean;
  groupId: string;
  onClose: () => void;
  onClosed: () => void;
}

type RefundRow = {
  userId: string;
  name: string;
  contribution: number;
  proportional: number;
};

// Money is kept in integer cents inside this component so the sum-check is
// exact and the backend's ±0.01 tolerance is only there for the final hop.
const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

export default function CloseGroupModal({ isOpen, groupId, onClose, onClosed }: Props) {
  const { t } = useTranslation();

  const { data: preview, isFetching, error: previewError } =
    useGetGroupClosePreviewQuery(groupId, { skip: !isOpen || !groupId });

  const [closeGroupMut, { isLoading: isClosing }] = useCloseGroupMutation();

  const [refundCentsByUser, setRefundCentsByUser] = useState<Record<string, number>>({});
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const rows: RefundRow[] = useMemo(() => {
    if (!preview) return [];
    return preview.members.map((m) => ({
      userId: m.userId.toString(),
      name: m.name,
      contribution: m.contribution,
      proportional: m.proportionalRefund,
    }));
  }, [preview]);

  // Seed the override map from the proportional preview the first time it
  // arrives — admin tweaks then track local state.
  useEffect(() => {
    if (!preview) return;
    const seed: Record<string, number> = {};
    for (const m of preview.members) {
      seed[m.userId.toString()] = toCents(m.proportionalRefund);
    }
    setRefundCentsByUser(seed);
    setTouched(false);
    setSubmitError("");
  }, [preview]);

  // Reset everything when the modal closes so reopening starts clean.
  useEffect(() => {
    if (!isOpen) {
      setRefundCentsByUser({});
      setTouched(false);
      setSubmitError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    (first ?? dialogRef.current)?.focus?.();
    return () => { previouslyFocusedRef.current?.focus?.(); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  const balance = preview?.currentBalance ?? 0;
  const balanceCents = toCents(balance);
  const sumCents = Object.values(refundCentsByUser).reduce((s, c) => s + c, 0);
  const diffCents = sumCents - balanceCents;
  const isBalanced = Math.abs(diffCents) <= 1; // align with backend SUM_TOLERANCE_CENTS

  const handleAmountChange = (userId: string, raw: string) => {
    setTouched(true);
    if (raw.trim() === "") {
      setRefundCentsByUser((prev) => ({ ...prev, [userId]: 0 }));
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0) return;
    setRefundCentsByUser((prev) => ({ ...prev, [userId]: toCents(n) }));
  };

  const handleConfirm = async () => {
    if (!isBalanced || isClosing || !preview) return;
    setSubmitError("");

    // Send overrides only when the admin actually edited values; an untouched
    // preview round-trips as the proportional split server-side.
    const overrides = touched
      ? rows.map((r) => ({
          userId: r.userId,
          refundAmount: fromCents(refundCentsByUser[r.userId] ?? 0),
        }))
      : undefined;

    try {
      await closeGroupMut({ groupId, overrides }).unwrap();
      onClosed();
    } catch (e: any) {
      const errs = e?.data?.errors;
      if (Array.isArray(errs) && errs.length > 0) {
        setSubmitError(errs.map((er: any) => er.message).join(", "));
      } else {
        setSubmitError(e?.data?.message || "Failed to close group");
      }
    }
  };

  const previewErrorMsg = previewError
    ? ((previewError as any)?.data?.message ?? "Failed to load preview")
    : "";

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 bg-black/75 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative my-auto w-full max-w-[560px] rounded-2xl border border-white/[0.08] bg-[#080c14] px-6 py-6 shadow-2xl animate-[fadeUp_0.18s_ease-out] max-h-[90vh] flex flex-col outline-none"
      >

        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent rounded-full" />

        <div className="mb-4 flex items-center gap-3 shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20">
            <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/60">
              {t("deleteModal.destructiveAction")}
            </p>
            <h2 id={titleId} className="text-[15px] font-semibold text-white/90 leading-tight">
              {t("closeGroup.title", "Close Group")}
            </h2>
          </div>
        </div>

        <div className="mb-3 h-px bg-white/[0.06] shrink-0" />

        <div className="overflow-y-auto pr-1 flex-1">
          {isFetching && (
            <p className="text-xs text-white/40">{t("closeGroup.loading", "Loading preview…")}</p>
          )}

          {previewErrorMsg && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-3.5 py-2.5">
              <p className="text-xs text-red-400/80">{previewErrorMsg}</p>
            </div>
          )}

          {preview && !isFetching && (
            <>
              <p className="text-[11px] text-white/40 mb-4">
                {t(
                  "closeGroup.description",
                  "Closing distributes the remaining balance back to members as a single refund expense. Edit amounts if you need to override the proportional split — the total must match the current balance."
                )}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">
                    {t("closeGroup.balance", "Group balance")}
                  </p>
                  <p className="font-mono text-[15px] font-semibold text-white/90" translate="no">
                    ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`rounded-xl border px-3 py-2.5 ${
                  isBalanced
                    ? "border-emerald-500/15 bg-emerald-500/[0.05]"
                    : "border-amber-500/20 bg-amber-500/[0.06]"
                }`}>
                  <p className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">
                    {t("closeGroup.refundsTotal", "Refunds total")}
                  </p>
                  <p className={`font-mono text-[15px] font-semibold ${
                    isBalanced ? "text-emerald-300" : "text-amber-300"
                  }`} translate="no">
                    ₹{fromCents(sumCents).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {!isBalanced && (
                <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
                  <p className="text-[11px] text-amber-300/90">
                    {diffCents > 0
                      ? t("closeGroup.over", { amount: fromCents(diffCents).toFixed(2), defaultValue: "Refunds exceed balance by ₹{{amount}}" })
                      : t("closeGroup.under", { amount: fromCents(-diffCents).toFixed(2), defaultValue: "Refunds short of balance by ₹{{amount}}" })}
                  </p>
                </div>
              )}

              <div className="space-y-2 mb-3">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-1 text-[10px] uppercase tracking-widest text-white/30">
                  <span>{t("closeGroup.member", "Member")}</span>
                  <span className="text-right">{t("closeGroup.contributed", "Contributed")}</span>
                  <span className="text-right w-28">{t("closeGroup.refund", "Refund")}</span>
                </div>

                {rows.map((row) => (
                  <div
                    key={row.userId}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] text-white/85 truncate" translate="no">{row.name}</p>
                      <p className="text-[10px] font-mono text-white/35" translate="no">
                        {t("closeGroup.proportional", "Proportional")}: ₹
                        {row.proportional.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <p className="font-mono text-[12px] text-white/60 text-right" translate="no">
                      ₹{row.contribution.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={fromCents(refundCentsByUser[row.userId] ?? 0)}
                      onChange={(e) => handleAmountChange(row.userId, e.target.value)}
                      className="w-28 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 font-mono text-[12px] text-right text-white outline-none focus:border-red-500/30 focus:ring-1 focus:ring-red-500/10 transition"
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {submitError && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-3.5 py-2.5">
              <svg className="h-3.5 w-3.5 shrink-0 text-red-400" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 4.5v3M7 9h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <p className="text-xs text-red-400/80">{submitError}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 shrink-0">
          <button
            onClick={onClose}
            disabled={isClosing}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-white/70 active:bg-white/[0.06] active:text-white/70 disabled:opacity-50"
          >
            {t("deleteModal.cancel")}
          </button>

          <button
            onClick={handleConfirm}
            disabled={!isBalanced || isClosing || !preview || isFetching}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-150 ${
              isBalanced && !isClosing && preview && !isFetching
                ? "bg-red-500/80 border border-red-500/50 text-white hover:bg-red-500/90 active:bg-red-500"
                : "bg-red-500/[0.06] border border-red-500/10 text-red-400/25 cursor-not-allowed"
            }`}
          >
            {isClosing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 8" />
                </svg>
                {t("closeGroup.closing", "Closing…")}
              </span>
            ) : (
              t("closeGroup.confirm", "Close Group")
            )}
          </button>
        </div>

        <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-widest text-white/15">
          {t("deleteModal.cannotUndo")}
        </p>
      </div>
    </div>
  );
}
