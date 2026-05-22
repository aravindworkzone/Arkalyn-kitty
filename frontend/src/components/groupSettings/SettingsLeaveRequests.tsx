import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GroupMember } from "../../interface/member";
import { useFieldError } from "../../hooks/useFieldError";
import type { LeaveRequestField } from "../../handlers/useGroupDetailHandlers";
import { ActionButton, AmountInput, INPUT_CLASS } from "../ui";

interface Props {
  members: GroupMember[] | undefined;
  isSuperAdmin: boolean;
  isApprovingLeave: boolean;
  isRejectingLeave: boolean;
  handleApproveLeave: (
    memberId: string,
    settlementAmount: string,
    maxAmount: number,
    setFieldError: ReturnType<typeof useFieldError<LeaveRequestField>>["setFieldError"]
  ) => Promise<void>;
  handleRejectLeave: (memberId: string) => Promise<void>;
}

interface RowProps {
  member: GroupMember;
  isSuperAdmin: boolean;
  isApprovingLeave: boolean;
  isRejectingLeave: boolean;
  onApprove: Props["handleApproveLeave"];
  onReject: Props["handleRejectLeave"];
}

function LeaveRequestRow({ member, isSuperAdmin, isApprovingLeave, isRejectingLeave, onApprove, onReject }: RowProps) {
  const { t } = useTranslation();
  const maxAmount = member.contribution ?? 0;
  const [amount, setAmount] = useState(maxAmount > 0 ? String(maxAmount) : "");
  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<LeaveRequestField>();

  // An admin's leave request can only be acted on by the super admin.
  const locked = member.role === "ADMIN" && !isSuperAdmin;

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-white/80 truncate" translate="no">
            {member.userId.name}
          </p>
          <p className="text-[11px] text-white/30 mt-0.5" translate="no">
            {t("leaveRequests.contributed", { amount: maxAmount.toLocaleString("en-IN") })}
          </p>
        </div>
        {member.leaveRequestedAt && (
          <span className="text-[10px] text-white/25 shrink-0" translate="no">
            {new Date(member.leaveRequestedAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        )}
      </div>

      {maxAmount > 0 && !locked && (
        <AmountInput
          size="md"
          value={amount}
          onChange={setAmount}
          max={maxAmount}
          error={fieldErrors.leaveSettle}
          onClearError={() => clearFieldError("leaveSettle")}
          placeholder={t("groupDetail.settlementAmount")}
          inputClassName={INPUT_CLASS}
        />
      )}

      {locked ? (
        <p className="text-[11px] text-amber-400/70">
          {t(
            "leaveRequests.superAdminOnly",
            "Only the super admin can approve or reject an admin's leave request.",
          )}
        </p>
      ) : (
        <div className="flex gap-2">
          <ActionButton
            tone="green"
            loading={isApprovingLeave}
            loadingLabel={t("leaveRequests.approving")}
            onClick={() => onApprove(member.userId._id, amount, maxAmount, setFieldError)}
          >
            {t("leaveRequests.approve")}
          </ActionButton>
          <ActionButton
            tone="red"
            loading={isRejectingLeave}
            loadingLabel={t("leaveRequests.rejecting")}
            onClick={() => onReject(member.userId._id)}
          >
            {t("leaveRequests.reject")}
          </ActionButton>
        </div>
      )}
    </div>
  );
}

export default function SettingsLeaveRequests({
  members,
  isSuperAdmin,
  isApprovingLeave,
  isRejectingLeave,
  handleApproveLeave,
  handleRejectLeave,
}: Props) {
  const { t } = useTranslation();
  const pending = (members ?? []).filter((m) => m.leaveRequestedAt);

  if (pending.length === 0) {
    return (
      <p className="text-center text-white/25 text-xs py-10">
        {t("leaveRequests.empty")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/30">{t("leaveRequests.description")}</p>
      {pending.map((member) => (
        <LeaveRequestRow
          key={member._id}
          member={member}
          isSuperAdmin={isSuperAdmin}
          isApprovingLeave={isApprovingLeave}
          isRejectingLeave={isRejectingLeave}
          onApprove={handleApproveLeave}
          onReject={handleRejectLeave}
        />
      ))}
    </div>
  );
}
