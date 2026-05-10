import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GroupMember } from "../../interface/member";
import { useFieldError } from "../../hooks/useFieldError";
import type { ContributionField, ContributionDescField } from "../../handlers/useGroupDetailHandlers";
import { ActionButton, AmountInput, FieldInput, MemberSelect, INPUT_CLASS } from "../ui";

interface Props {
  members: GroupMember[] | undefined;
  isAddingContrib: boolean;
  handleAddContribution: (
    myContrib: string,
    contribMemberId: string,
    setMyContrib: React.Dispatch<React.SetStateAction<string>>,
    setContribMemberId: React.Dispatch<React.SetStateAction<string>>,
    setFieldError: ReturnType<typeof useFieldError<ContributionField>>["setFieldError"],
    myContribDesc: string,
    setMyContribDesc: React.Dispatch<React.SetStateAction<string>>,
    setContribErrorDesc: ReturnType<typeof useFieldError<ContributionDescField>>["setFieldError"],
  ) => Promise<void>;
}

export default function SettingsContribution({ members, isAddingContrib, handleAddContribution }: Props) {
  const { t } = useTranslation();
  const [myContrib, setMyContrib] = useState("");
  const [myContribDesc, setMyContribDesc] = useState("");
  const [contribMemberId, setContribMemberId] = useState("");
  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<ContributionField>();
  const { fieldErrors: descErrors, setFieldError: setDescError, clearFieldError: clearDescError } = useFieldError<ContributionDescField>();

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/30">{t("groupDetail.addFundsDesc")}</p>

      <MemberSelect
        members={members}
        value={contribMemberId}
        onChange={setContribMemberId}
        placeholder={t("groupDetail.myContribution")}
        placeholderDisabled={false}
        renderLabel={(m) => `${m.userId.name} · ₹${m.contribution.toLocaleString("en-IN")} current`}
      />

      <AmountInput
        size="md"
        value={myContrib}
        onChange={setMyContrib}
        error={fieldErrors.myContrib}
        onClearError={() => clearFieldError("myContrib")}
        placeholder={t("groupDetail.amount")}
        inputClassName={INPUT_CLASS}
      />

      <FieldInput
        type="text"
        inputMode="text"
        value={myContribDesc}
        onChange={(e) => setMyContribDesc(e.target.value)}
        error={descErrors.myContribDesc}
        onClearError={() => clearDescError("myContribDesc")}
        placeholder={t("groupDetail.description")}
        className={INPUT_CLASS}
      />

      <ActionButton
        tone="violet"
        loading={isAddingContrib}
        loadingLabel={t("groupDetail.addingContrib")}
        disabled={!myContrib || Number(myContrib) <= 0}
        onClick={() =>
          handleAddContribution(
            myContrib, contribMemberId,
            setMyContrib, setContribMemberId, setFieldError,
            myContribDesc, setMyContribDesc, setDescError,
          )
        }
      >
        {t("groupDetail.addContribution")}
      </ActionButton>
    </div>
  );
}
