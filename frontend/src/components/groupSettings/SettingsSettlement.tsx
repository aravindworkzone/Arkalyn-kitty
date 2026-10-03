import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GroupMember } from "../../interface/member";
import { useFieldError } from "../../hooks/useFieldError";
import type { SettlementField } from "../../handlers/useGroupDetailHandlers";
import { ActionButton, AmountInput, MemberSelect, INPUT_CLASS, Note } from "../ui";

interface Props {
  members: GroupMember[] | undefined;
  isSettling: boolean;
  handleSettlement: (
    settleMemberId: string,
    settleAmount: string,
    setSettleMemberId: React.Dispatch<React.SetStateAction<string>>,
    setSettleAmount: React.Dispatch<React.SetStateAction<string>>,
    setFieldError: ReturnType<typeof useFieldError<SettlementField>>["setFieldError"],
    maxAmount?: number,
  ) => Promise<void>;
  /** On a Reserve: what its Family groups owe it right now. */
  lentOut?: number;
}

export default function SettingsSettlement({ members, isSettling, handleSettlement, lentOut = 0 }: Props) {
  const { t } = useTranslation();
  const [settleMemberId, setSettleMemberId] = useState("");
  const [settleAmount, setSettleAmount] = useState("0");
  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<SettlementField>();

  const settleMaxAmount =
    members?.find((m) => m.userId._id === settleMemberId)?.contribution ?? 0;

  return (
    <div className="space-y-3">
      {/* Paying a member out shrinks the wallet that covers Family groups'
          credit spending; once it is short, their spends start failing. Said up
          front so the admin settles knowing what is out on loan. */}
      {lentOut > 0 && (
        <Note tone="warning" translate="no">
          {t("groupDetail.settleLentOut", {
            amount: lentOut.toLocaleString("en-IN"),
            defaultValue:
              "₹{{amount}} is lent out to Family groups right now. Paying members out lowers the wallet that covers their credit spending.",
          })}
        </Note>
      )}

      <MemberSelect
        members={members}
        value={settleMemberId}
        onChange={setSettleMemberId}
        placeholder={t("groupDetail.selectMemberToSettle")}
        filter={(m) => !m.settlement}
        renderLabel={(m) => `${m.userId.name} · ₹${m.contribution.toLocaleString("en-IN")}`}
      />

      <AmountInput
        size="md"
        value={settleAmount}
        onChange={setSettleAmount}
        max={settleMaxAmount}
        error={fieldErrors.settleAmount}
        onClearError={() => clearFieldError("settleAmount")}
        placeholder={t("groupDetail.settlementAmount")}
        inputClassName={INPUT_CLASS}
      />

      <ActionButton
        tone="success"
        loading={isSettling}
        loadingLabel={t("groupDetail.settling")}
        disabled={!settleMemberId}
        onClick={() => handleSettlement(settleMemberId, settleAmount, setSettleMemberId, setSettleAmount, setFieldError, settleMaxAmount)}
      >
        {t("groupDetail.settleMember")}
      </ActionButton>
    </div>
  );
}
