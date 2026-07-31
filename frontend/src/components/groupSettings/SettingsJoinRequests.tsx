import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { JoinRequest } from "../../interface/invite";
import { ActionButton, BottomSheet } from "../ui";

export interface DeclineJoinArgs {
  inviteId: string;
  invitedUserId: string;
  /** When true, a fresh invite goes out right after the decline lands. */
  reinvite: boolean;
}

interface Props {
  requests: JoinRequest[] | undefined;
  onApprove: (inviteId: string) => Promise<void>;
  onDecline: (args: DeclineJoinArgs) => Promise<void>;
  isApproving: boolean;
  isDeclining: boolean;
  error?: string;
}

function JoinRequestRow({
  request,
  onApprove,
  onDecline,
  isApproving,
  isDeclining,
}: {
  request: JoinRequest;
  onApprove: (inviteId: string) => Promise<void>;
  onDecline: (args: DeclineJoinArgs) => Promise<void>;
  isApproving: boolean;
  isDeclining: boolean;
}) {
  const { t } = useTranslation();
  // Only the row being acted on shows a spinner — the mutation flag is global.
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reinvite, setReinvite] = useState(false);
  const reinviteId = useId();

  const amount = (request.contribution ?? 0).toLocaleString("en-IN");

  const approve = async () => {
    setBusy("approve");
    try {
      await onApprove(request._id);
    } finally {
      setBusy(null);
    }
  };

  const openConfirm = () => {
    setReinvite(false);
    setConfirmOpen(true);
  };

  const confirmDecline = async () => {
    setBusy("decline");
    try {
      await onDecline({
        inviteId: request._id,
        invitedUserId: request.invitedUser._id,
        reinvite,
      });
    } finally {
      setBusy(null);
      // Failures surface in the list-level banner, so the sheet closes either
      // way rather than trapping the user behind a dialog with no feedback.
      setConfirmOpen(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-white/80 truncate" translate="no">
            {request.invitedUser.name}
          </p>
          <p className="text-[11px] text-white/30 mt-0.5 truncate" translate="no">
            {request.invitedUser.email}
          </p>
          <p className="text-[11px] text-white/40 mt-1.5" translate="no">
            {t("joinRequests.contribution", { amount })}
          </p>
          {request.invitedBy && (
            <p className="text-[10px] text-white/25 mt-0.5" translate="no">
              {t("joinRequests.invitedBy", { name: request.invitedBy.name })}
            </p>
          )}
        </div>
        {request.respondedAt && (
          <span className="text-[10px] text-white/25 shrink-0" translate="no">
            {new Date(request.respondedAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <ActionButton
          tone="green"
          loading={isApproving && busy === "approve"}
          loadingLabel={t("joinRequests.approving")}
          onClick={approve}
        >
          {t("joinRequests.approve")}
        </ActionButton>
        <ActionButton tone="red" onClick={openConfirm}>
          {t("joinRequests.decline")}
        </ActionButton>
      </div>

      <BottomSheet
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("joinRequests.confirmTitle")}
        tone="danger"
        footer={
          <div className="flex gap-2">
            <ActionButton
              tone="red"
              loading={isDeclining && busy === "decline"}
              loadingLabel={t("joinRequests.declining")}
              onClick={confirmDecline}
            >
              {reinvite
                ? t("joinRequests.confirmDeclineAndReinvite")
                : t("joinRequests.confirmDecline")}
            </ActionButton>
            <ActionButton tone="neutral" onClick={() => setConfirmOpen(false)}>
              {t("joinRequests.confirmCancel")}
            </ActionButton>
          </div>
        }
      >
        <p className="text-xs text-white/50">
          {t("joinRequests.confirmBody", { name: request.invitedUser.name, amount })}
        </p>

        <label
          htmlFor={reinviteId}
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/[0.07]
            bg-white/[0.02] px-3.5 py-3 cursor-pointer hover:bg-white/[0.04] transition-colors"
        >
          <input
            id={reinviteId}
            type="checkbox"
            checked={reinvite}
            onChange={(e) => setReinvite(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-cyan-400"
          />
          <span className="min-w-0">
            <span className="block text-[12px] font-medium text-white/70">
              {t("joinRequests.reinviteLabel")}
            </span>
            <span className="mt-0.5 block text-[11px] text-white/35">
              {t("joinRequests.reinviteHint")}
            </span>
          </span>
        </label>
      </BottomSheet>
    </div>
  );
}

export default function SettingsJoinRequests({
  requests,
  onApprove,
  onDecline,
  isApproving,
  isDeclining,
  error,
}: Props) {
  const { t } = useTranslation();
  const pending = requests ?? [];

  if (pending.length === 0) {
    return (
      <p className="text-center text-white/25 text-xs py-6">{t("joinRequests.empty")}</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/30">{t("joinRequests.description")}</p>
      {error && <p className="text-[11px] text-red-400/80">{error}</p>}
      {pending.map((request) => (
        <JoinRequestRow
          key={request._id}
          request={request}
          onApprove={onApprove}
          onDecline={onDecline}
          isApproving={isApproving}
          isDeclining={isDeclining}
        />
      ))}
    </div>
  );
}
