import { useRef } from "react";
import DetailModal from "./DetailModal";
import ShareCard from "./ShareCard";
import type { GroupCredit } from "../interface/transaction";
import { useCreditModalHandlers } from "../handlers/useCreditModalHandlers";
import { useShareAsImage } from "../hooks/useShareAsImage";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-6 py-2.5 border-b border-line last:border-0">
    <span className="text-theme-2xs font-semibold uppercase tracking-widest text-fg-muted shrink-0 pt-0.5">
      {label}
    </span>
    <div className="text-right">{children}</div>
  </div>
);

export default function CreditDetailModal({
  credit,
  onClose,
  role,
  groupId,
  group,
}: {
  credit: GroupCredit | null;
  onClose: () => void;
  role?: string;
  groupId?: string;
  group?: { name?: string; displayId?: string } | null;
}) {
  const {
    showRemove, setShowRemove,
    reason, setReason,
    removeError, setRemoveError,
    isRemoving,
    handleClose,
    handleRemove,
  } = useCreditModalHandlers(onClose);

  const cardRef = useRef<HTMLDivElement>(null);
  const {
    shareImage,
    downloadImage,
    isSharing,
    isDownloading,
    error: shareError,
  } = useShareAsImage(cardRef);

  // Removing a credit reverses a wallet deposit, so it is restricted to the super admin.
  //
  // A chit contribution is excluded outright, whatever the role: removeCreditService
  // refuses it, because reversing the wallet here would leave the due still
  // claiming it was paid. Undoing one belongs on the chit board, which unwinds the
  // due, the cycle's collected total, the member's contribution and the wallet
  // together. The server resolves the flag so this button and that rule cannot
  // disagree.
  const isChitCredit = Boolean(credit?.isChitCredit);
  // Money another group sent over a connection (a Family group paying or
  // depositing into a Reserve). Also refused by removeCreditService: undoing it
  // here would leave the other group's side of the books unchanged.
  const isLinkCredit = Boolean(credit?.isLinkCredit);
  const canRemove = role === "SUPER_ADMIN" && !isChitCredit && !isLinkCredit;

  if (!credit) return null;

  const dateLabel = new Date(credit.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLabel = new Date(credit.createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <DetailModal isOpen={!!credit} onClose={handleClose} title="Credit Detail">
      {/* hero */}
      <div className="mb-5 pb-5 border-b border-line">
        <p className="font-mono text-title-md font-semibold text-success-700 dark:text-success-300 leading-none">
          +₹{credit.amount.toLocaleString("en-IN")}
        </p>
        <p className="text-sm font-medium text-fg-muted mt-2 leading-snug">
          {credit.description || "Contribution"}
        </p>
      </div>

      {/* detail rows */}
      <div>
        <Row label="Type">
          <span
            className="text-theme-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ background: "#10b98120", color: "#34d399" }}
          >
            CREDIT
          </span>
        </Row>

        <Row label={isLinkCredit ? "Sent by" : "Contributed by"}>
          <div>
            <p className="text-theme-sm text-fg leading-tight">{credit.performedBy?.name}</p>
            {credit.performedBy?.email && (
              <p className="text-theme-xs text-fg-muted mt-0.5">{credit.performedBy.email}</p>
            )}
          </div>
        </Row>

        <Row label="Date">
          <span className="text-theme-sm text-fg">{dateLabel}</span>
        </Row>

        <Row label="Logged at">
          <span className="text-theme-sm text-fg">{timeLabel}</span>
        </Row>
      </div>

      {/* share section — visible to everyone */}
      <div className="mt-5 pt-4 border-t border-line">
        <div className="flex gap-2">
          <button
            onClick={() =>
              shareImage({
                filename: `credit-${group?.displayId ?? "group"}-${credit._id}.png`,
                shareTitle: `Credit · ₹${credit.amount.toLocaleString("en-IN")}`,
                shareText: `${credit.description || "Contribution"} · ₹${credit.amount.toLocaleString("en-IN")}`,
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
                filename: `credit-${group?.displayId ?? "group"}-${credit._id}.png`,
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
      <ShareCard ref={cardRef} type="credit" credit={credit} group={group} />

      {/* Why the remove button is absent, for the one viewer who would otherwise
          have had it. Shown instead of the button rather than as a disabled one:
          a disabled control invites a second click, this names the way forward. */}
      {isChitCredit && role === "SUPER_ADMIN" && (
        <div className="mt-5 pt-4 border-t border-line">
          <p className="text-theme-xs text-fg-muted leading-snug">
            This is a chit contribution. Undo it from the group's chit page, so the
            cycle stays in step with the wallet.
          </p>
        </div>
      )}
      {isLinkCredit && role === "SUPER_ADMIN" && (
        <div className="mt-5 pt-4 border-t border-line">
          <p className="text-theme-xs text-fg-muted leading-snug">
            This money was sent by a connected group, so it can't be removed here.
            It stays in step with that group's records.
          </p>
        </div>
      )}

      {/* remove section — super admin only */}
      {canRemove && (
        <div className="mt-5 pt-4 border-t border-line">
          {!showRemove ? (
            <button
              onClick={() => setShowRemove(true)}
              className="w-full py-2 rounded-xl border border-error-200 dark:border-error-500/20 bg-error-50 dark:bg-error-500/[0.07] text-error-600 dark:text-error-400 text-theme-xs font-semibold hover:bg-error-50 dark:bg-error-500/[0.14] active:bg-error-50 dark:bg-error-500/[0.14] transition-colors"
            >
              Remove Credit
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-theme-xs text-warning-700 dark:text-warning-300 leading-snug">
                This pulls ₹{credit.amount.toLocaleString("en-IN")} back out of the group wallet and
                lowers the contributor's total. It cannot be undone.
              </p>
              <p className="text-theme-xs text-fg-muted uppercase tracking-widest font-semibold">Removal reason (optional)</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Duplicate contribution, wrong amount..."
                rows={2}
                className="w-full bg-surface-hover border border-line rounded-xl px-3 py-2 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-error-200 dark:border-error-500/40 resize-none transition-all"
              />
              {removeError && (
                <p className="text-theme-xs text-error-600 dark:text-error-400">{removeError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowRemove(false); setReason(""); setRemoveError(""); }}
                  className="flex-1 py-2 rounded-xl border border-line text-fg-muted text-theme-xs font-semibold hover:bg-surface-hover active:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRemove(credit, groupId)}
                  disabled={isRemoving}
                  className="flex-1 py-2 rounded-xl bg-error-50 dark:bg-error-500/20 border border-error-200 dark:border-error-500/30 text-error-600 dark:text-error-400 text-theme-xs font-semibold hover:bg-error-50 dark:bg-error-500/30 active:bg-error-50 dark:bg-error-500/30 disabled:opacity-50 transition-colors"
                >
                  {isRemoving ? "Removing…" : "Confirm Remove"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </DetailModal>
  );
}
