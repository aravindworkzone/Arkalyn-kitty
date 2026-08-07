import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import DetailModal from "./DetailModal";
import ShareCard from "./ShareCard";
import type { Expense } from "../interface/expense";
import { useExpenseModalHandlers } from "../handlers/useExpenseModalHandlers";
import { useShareAsImage } from "../hooks/useShareAsImage";
import { useGetUserQuery } from "../redux/api/auth";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-line last:border-0">
    <span className="text-theme-2xs font-semibold uppercase tracking-widest text-fg-muted shrink-0 pt-0.5">
      {label}
    </span>
    <div className="flex-1 text-right min-w-0">{children}</div>
  </div>
);

export default function ExpenseDetailModal({
  expense,
  onClose,
  role,
  groupId,
  group,
}: {
  expense: Expense | null;
  onClose: () => void;
  role?: string;
  groupId?: string;
  group?: { name?: string; displayId?: string } | null;
}) {
  const {
    showRefund, setShowRefund,
    reason, setReason,
    refundError, setRefundError,
    isDeleting,
    handleClose,
    handleRefund,
  } = useExpenseModalHandlers(onClose);

  const navigate = useNavigate();
  const { data: meData } = useGetUserQuery();
  const currentUserId = (meData as any)?.data?.user?._id as string | undefined;

  const cardRef = useRef<HTMLDivElement>(null);
  const {
    shareImage,
    downloadImage,
    isSharing,
    isDownloading,
    error: shareError,
  } = useShareAsImage(cardRef);

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const canDelete = isAdmin;
  // Admins can edit any expense; the payer can edit their own.
  const canEdit = isAdmin || (!!currentUserId && expense?.paidBy._id === currentUserId);

  if (!expense) return null;

  const dateLabel = new Date(expense.date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <DetailModal isOpen={!!expense} onClose={handleClose} title="Expense Detail">
      {/* hero */}
      <div className="mb-5 pb-5 border-b border-line">
        <p className="font-mono text-title-md font-semibold text-fg leading-none">
          ₹{expense.amount.toLocaleString("en-IN")}
        </p>
        <p className="text-sm font-medium text-fg-muted mt-2 leading-snug">{expense.title}</p>
        {expense.description && (
          <p className="text-theme-xs text-fg-muted mt-2 leading-relaxed">{expense.description}</p>
        )}
      </div>

      {/* detail rows */}
      <div>
        <Row label="Category">
          <span
            className="text-theme-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ background: expense.category.color + "20", color: expense.category.color }}
          >
            {expense.category.name}
          </span>
        </Row>

        <Row label="Paid by">
          <div className="min-w-0">
            <p className="text-theme-sm text-fg leading-tight break-words">{expense.paidBy.name}</p>
            <p className="text-theme-xs text-fg-muted mt-0.5 break-all">{expense.paidBy.email}</p>
          </div>
        </Row>

        <Row label="Payment">
          <span className="text-theme-xs font-semibold px-2 py-0.5 rounded-md border border-line bg-surface-hover text-fg-muted">
            {expense.paymentType}
          </span>
        </Row>

        <Row label="Date">
          <span className="text-theme-sm text-fg">{dateLabel}</span>
        </Row>

        <Row label="Split">
          {expense.splitBetween?.length > 0 ? (
            <div className="space-y-1.5 text-left">
              {expense.splitBetween.map((s) => (
                <div key={s.userId._id} className="flex items-center justify-between gap-3">
                  <span className="text-theme-xs text-fg truncate">{s.userId.name}</span>
                  <span className="text-theme-xs font-mono text-fg shrink-0">
                    ₹{s.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-theme-xs text-fg-muted">No split</span>
          )}
        </Row>
      </div>

      {/* share section — visible to everyone */}
      <div className="mt-5 pt-4 border-t border-line">
        <div className="flex gap-2">
          <button
            onClick={() =>
              shareImage({
                filename: `expense-${group?.displayId ?? "group"}-${expense._id}.png`,
                shareTitle: `Expense · ₹${expense.amount.toLocaleString("en-IN")}`,
                shareText: `${expense.title} · ₹${expense.amount.toLocaleString("en-IN")}`,
              })
            }
            disabled={isSharing || isDownloading}
            className="flex-1 py-2 rounded-xl border border-line bg-surface-hover text-fg text-theme-xs font-semibold hover:bg-surface-hover active:bg-surface-hover disabled:opacity-50 transition-colors"
          >
            {isSharing ? "Preparing…" : "Share"}
          </button>
          <button
            onClick={() =>
              downloadImage({
                filename: `expense-${group?.displayId ?? "group"}-${expense._id}.png`,
              })
            }
            disabled={isSharing || isDownloading}
            className="flex-1 py-2 rounded-xl border border-line bg-surface-hover text-fg text-theme-xs font-semibold hover:bg-surface-hover active:bg-surface-hover disabled:opacity-50 transition-colors"
          >
            {isDownloading ? "Downloading…" : "Download"}
          </button>
        </div>
        {shareError && (
          <p className="mt-2 text-theme-xs text-error-600 dark:text-error-400">{shareError}</p>
        )}
      </div>

      {/* hidden off-screen card used as the image source */}
      <ShareCard ref={cardRef} type="expense" expense={expense} group={group} />

      {/* edit section — admins or the expense's payer */}
      {canEdit && groupId && (
        <div className="mt-5 pt-4 border-t border-line">
          <button
            onClick={() => {
              handleClose();
              navigate(`/groups/${groupId}/expenses/${expense._id}/edit`);
            }}
            className="w-full py-2 rounded-xl border border-brand-200 dark:border-brand-500/25 bg-brand-50 dark:bg-brand-500/[0.08] text-brand-600 dark:text-brand-300 text-theme-xs font-semibold hover:bg-brand-50 dark:bg-brand-500/[0.15] active:bg-brand-50 dark:bg-brand-500/[0.15] transition-colors"
          >
            Edit Expense
          </button>
        </div>
      )}

      {/* delete / refund section — admin/super_admin only */}
      {canDelete && (
        <div className="mt-5 pt-4 border-t border-line">
          {!showRefund ? (
            <button
              onClick={() => setShowRefund(true)}
              className="w-full py-2 rounded-xl border border-error-200 dark:border-error-500/20 bg-error-50 dark:bg-error-500/[0.07] text-error-600 dark:text-error-400 text-theme-xs font-semibold hover:bg-error-50 dark:bg-error-500/[0.14] active:bg-error-50 dark:bg-error-500/[0.14] transition-colors"
            >
              Refund Expense
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-theme-xs text-fg-muted uppercase tracking-widest font-semibold">Refund reason (optional)</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Duplicate entry, wrong amount..."
                rows={2}
                className="w-full bg-surface-hover border border-line rounded-xl px-3 py-2 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-error-200 dark:border-error-500/40 resize-none transition-all"
              />
              {refundError && (
                <p className="text-theme-xs text-error-600 dark:text-error-400">{refundError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowRefund(false); setReason(""); setRefundError(""); }}
                  className="flex-1 py-2 rounded-xl border border-line text-fg-muted text-theme-xs font-semibold hover:bg-surface-hover active:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRefund(expense, groupId)}
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-xl bg-error-50 dark:bg-error-500/20 border border-error-200 dark:border-error-500/30 text-error-600 dark:text-error-400 text-theme-xs font-semibold hover:bg-error-50 dark:bg-error-500/30 active:bg-error-50 dark:bg-error-500/30 disabled:opacity-50 transition-colors"
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
