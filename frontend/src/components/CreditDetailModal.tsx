import { useRef } from "react";
import DetailModal from "./DetailModal";
import ShareCard from "./ShareCard";
import type { GroupCredit } from "../interface/transaction";
import { useCreditModalHandlers } from "../handlers/useCreditModalHandlers";
import { useShareAsImage } from "../hooks/useShareAsImage";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-6 py-2.5 border-b border-white/[0.05] last:border-0">
    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 shrink-0 pt-0.5">
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
  const canRemove = role === "SUPER_ADMIN";

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
      <div className="mb-5 pb-5 border-b border-white/[0.06]">
        <p className="font-mono text-[34px] font-semibold text-[#e0fff0] leading-none">
          +₹{credit.amount.toLocaleString("en-IN")}
        </p>
        <p className="text-sm font-medium text-white/55 mt-2 leading-snug">
          {credit.description || "Contribution"}
        </p>
      </div>

      {/* detail rows */}
      <div>
        <Row label="Type">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
            style={{ background: "#10b98120", color: "#34d399" }}
          >
            CREDIT
          </span>
        </Row>

        <Row label="Contributed by">
          <div>
            <p className="text-[13px] text-white/75 leading-tight">{credit.performedBy?.name}</p>
            {credit.performedBy?.email && (
              <p className="text-[11px] text-white/30 mt-0.5">{credit.performedBy.email}</p>
            )}
          </div>
        </Row>

        <Row label="Date">
          <span className="text-[13px] text-white/60">{dateLabel}</span>
        </Row>

        <Row label="Logged at">
          <span className="text-[13px] text-white/60">{timeLabel}</span>
        </Row>
      </div>

      {/* share section — visible to everyone */}
      <div className="mt-5 pt-4 border-t border-white/[0.06]">
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
            className="flex-1 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white/70 text-[12px] font-semibold hover:bg-white/[0.08] active:bg-white/[0.08] disabled:opacity-50 transition-colors"
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
            className="flex-1 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white/70 text-[12px] font-semibold hover:bg-white/[0.08] active:bg-white/[0.08] disabled:opacity-50 transition-colors"
          >
            {isDownloading ? "Downloading…" : "Download"}
          </button>
        </div>
        {shareError && (
          <p className="mt-2 text-[11px] text-red-400">{shareError}</p>
        )}
      </div>

      {/* hidden off-screen card used as the image source */}
      <ShareCard ref={cardRef} type="credit" credit={credit} group={group} />

      {/* remove section — super admin only */}
      {canRemove && (
        <div className="mt-5 pt-4 border-t border-white/[0.06]">
          {!showRemove ? (
            <button
              onClick={() => setShowRemove(true)}
              className="w-full py-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] text-red-400 text-[12px] font-semibold hover:bg-red-500/[0.14] active:bg-red-500/[0.14] transition-colors"
            >
              Remove Credit
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-amber-400/70 leading-snug">
                This pulls ₹{credit.amount.toLocaleString("en-IN")} back out of the group wallet and
                lowers the contributor's total. It cannot be undone.
              </p>
              <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold">Removal reason (optional)</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Duplicate contribution, wrong amount..."
                rows={2}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/40 resize-none transition-all"
              />
              {removeError && (
                <p className="text-[11px] text-red-400">{removeError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowRemove(false); setReason(""); setRemoveError(""); }}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-white/40 text-[12px] font-semibold hover:bg-white/[0.04] active:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRemove(credit, groupId)}
                  disabled={isRemoving}
                  className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[12px] font-semibold hover:bg-red-500/30 active:bg-red-500/30 disabled:opacity-50 transition-colors"
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
