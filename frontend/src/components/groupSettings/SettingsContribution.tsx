import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { GroupMember } from "../../interface/member";
import { useFieldError } from "../../hooks/useFieldError";
import type { ContributionField, ContributionDescField } from "../../handlers/useGroupDetailHandlers";
import { ActionButton, AmountInput, FieldInput, MemberSelect, INPUT_CLASS } from "../ui";
import { useGetUserQuery } from "../../redux/api/auth";
import { useGetCreditCategoriesQuery } from "../../redux/api/category";

interface Props {
  groupId?: string;
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
    creditCategoryId?: string,
  ) => Promise<void>;
}

export default function SettingsContribution({ groupId, members, isAddingContrib, handleAddContribution }: Props) {
  const { t } = useTranslation();
  const { data: meData } = useGetUserQuery();
  const currentUserName = meData?.data?.user?.name ?? "";
  const currentUserId = meData?.data?.user?._id ?? "";
  const [myContrib, setMyContrib] = useState("");
  const [myContribDesc, setMyContribDesc] = useState("");
  const [contribMemberId, setContribMemberId] = useState("");
  const [creditCategoryId, setCreditCategoryId] = useState("");
  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<ContributionField>();
  const { fieldErrors: descErrors, setFieldError: setDescError, clearFieldError: clearDescError } = useFieldError<ContributionDescField>();

  // Credit categories the contribution can be tagged with. Backend returns them
  // sorted by usage (most-used first), so default to the first one.
  const { data: creditCategories = [] } = useGetCreditCategoriesQuery(groupId!, { skip: !groupId });
  useEffect(() => {
    if (!creditCategoryId && creditCategories.length > 0) {
      setCreditCategoryId(creditCategories[0]._id);
    }
  }, [creditCategories, creditCategoryId]);

  // A settled member is closed out — no further money may be added for them.
  // When no member is picked, the contribution defaults to the current user.
  const targetMemberId = contribMemberId || currentUserId;
  const targetSettled = !!members?.find((m) => m.userId._id === targetMemberId)?.settlement;

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/30">{t("groupDetail.addFundsDesc")}</p>

      <MemberSelect
        members={members}
        value={contribMemberId}
        onChange={setContribMemberId}
        placeholder={currentUserName ? `${currentUserName} (self)` : t("groupDetail.myContribution")}
        placeholderDisabled={false}
        filter={(m) => !m.settlement}
        renderLabel={(m) => `${m.userId.name} · ₹${m.contribution.toLocaleString("en-IN")} current`}
      />

      {targetSettled && (
        <p className="text-[11px] text-amber-400/70">
          {t(
            "groupDetail.settledNoContribution",
            "This member is already settled — contributions can no longer be added for them.",
          )}
        </p>
      )}

      <div data-tour="contrib-amount-field">
        <AmountInput
          size="md"
          value={myContrib}
          onChange={setMyContrib}
          error={fieldErrors.myContrib}
          onClearError={() => clearFieldError("myContrib")}
          placeholder={t("groupDetail.amount")}
          inputClassName={INPUT_CLASS}
        />
      </div>

      <div data-tour="contrib-desc-field">
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
      </div>

      {creditCategories.length > 0 && (
        <div>
          <label className="block text-[10px] font-semibold text-white/40 mb-1.5 uppercase tracking-widest">
            {t("groupDetail.creditCategory", "Credit category")}
          </label>
          <div className="flex flex-wrap gap-2">
            {creditCategories.map((cat) => (
              <button
                key={cat._id}
                type="button"
                onClick={() => setCreditCategoryId(cat._id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all duration-150"
                style={
                  creditCategoryId === cat._id
                    ? { background: cat.color + "25", borderColor: cat.color + "60", color: cat.color }
                    : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: creditCategoryId === cat._id ? cat.color : "rgba(255,255,255,0.2)" }}
                />
                <span translate="no">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div data-tour="contrib-submit">
        <ActionButton
          tone="violet"
          loading={isAddingContrib}
          loadingLabel={t("groupDetail.addingContrib")}
          disabled={!myContrib || Number(myContrib) <= 0 || targetSettled}
          onClick={() =>
            handleAddContribution(
              myContrib, contribMemberId,
              setMyContrib, setContribMemberId, setFieldError,
              myContribDesc, setMyContribDesc, setDescError,
              creditCategoryId || undefined,
            )
          }
        >
          {t("groupDetail.addContribution")}
        </ActionButton>
      </div>
    </div>
  );
}
