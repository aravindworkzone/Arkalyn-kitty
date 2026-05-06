import DetailModal from "./DetailModal";
import type { Expense } from "../interface/expense";
import { useExpenseModalHandlers } from "../handlers/useExpenseModalHandlers";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-6 py-2.5 border-b border-white/[0.05] last:border-0">
    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 shrink-0 pt-0.5">
      {label}
    </span>
    <div className="text-right">{children}</div>
  </div>
);

export default function ExpenseDetailModal({
  expense,
  onClose,
  role,
  groupId,
}: {
  expense: Expense | null;
  onClose: () => void;
  role?: string;
  groupId?: string;
}) {
  const {
    showRefund, setShowRefund,
    reason, setReason,
    refundError, setRefundError,
    isDeleting,
    handleClose,
    handleRefund,
  } = useExpenseModalHandlers(onClose);

  const canDelete = role === "SUPER_ADMIN" || role === "ADMIN";

  if (!expense) return null;

  const dateLabel = new Date(expense.date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <DetailModal isOpen={!!expense} onClose={handleClose} title="Expense Detail">
      {/* hero */}
      <div className="mb-5 pb-5 border-b border-white/[0.06]">
        <p className="font-mono text-[34px] font-semibold text-[#f0eeff] leading-none">
          ₹{expense.amount.toLocaleString("en-IN")}
        </p>
        <p className="text-sm font-medium text-white/55 mt-2 leading-snug">{expense.title}</p>
      </div>

      {/* detail rows */}
      <div>
        <Row label="Category">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
            style={{ background: expense.category.color + "20", color: expense.category.color }}
          >
            {expense.category.name}
          </span>
        </Row>

        <Row label="Paid by">
          <div>
            <p className="text-[13px] text-white/75 leading-tight">{expense.paidBy.name}</p>
            <p className="text-[11px] text-white/30 mt-0.5">{expense.paidBy.email}</p>
          </div>
        </Row>

        <Row label="Payment">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.05] text-white/50">
            {expense.paymentType}
          </span>
        </Row>

        <Row label="Date">
          <span className="text-[13px] text-white/60">{dateLabel}</span>
        </Row>

        <Row label="Split">
          {expense.splitBetween?.length > 0 ? (
            <div className="space-y-1.5 text-left">
              {expense.splitBetween.map((s) => (
                <div key={s.userId._id} className="flex items-center justify-between gap-6 min-w-[160px]">
                  <span className="text-[12px] text-white/60 truncate max-w-[100px]">{s.userId.name}</span>
                  <span className="text-[12px] font-mono text-white/75 shrink-0">
                    ₹{s.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-white/25">No split</span>
          )}
        </Row>
      </div>

      {/* delete / refund section — admin/super_admin only */}
      {canDelete && (
        <div className="mt-5 pt-4 border-t border-white/[0.06]">
          {!showRefund ? (
            <button
              onClick={() => setShowRefund(true)}
              className="w-full py-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] text-red-400 text-[12px] font-semibold hover:bg-red-500/[0.14] transition-colors"
            >
              Refund Expense
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold">Refund reason (optional)</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Duplicate entry, wrong amount..."
                rows={2}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/40 resize-none transition-all"
              />
              {refundError && (
                <p className="text-[11px] text-red-400">{refundError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowRefund(false); setReason(""); setRefundError(""); }}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-white/40 text-[12px] font-semibold hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRefund(expense, groupId)}
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[12px] font-semibold hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? "Processing…" : "Confirm Refund"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </DetailModal>
  );
}
