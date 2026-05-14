import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GroupMember } from "../../interface/member";
import { useFieldError } from "../../hooks/useFieldError";
import type { SettlementField } from "../../handlers/useGroupDetailHandlers";
import { ActionButton, AmountInput, MemberSelect, INPUT_CLASS } from "../ui";

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
}

export default function SettingsSettlement({ members, isSettling, handleSettlement }: Props) {
  const { t } = useTranslation();
  const [settleMemberId, setSettleMemberId] = useState("");
  const [settleAmount, setSettleAmount] = useState("0");
  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<SettlementField>();

  const settleMaxAmount =
    members?.find((m) => m.userId._id === settleMemberId)?.contribution ?? 0;

  return (
    <div className="space-y-3">
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
        tone="green"
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
