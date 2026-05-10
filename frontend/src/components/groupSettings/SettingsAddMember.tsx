import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFieldError } from "../../hooks/useFieldError";
import { useSearchUsersQuery, type UserSuggestion } from "../../redux/api/user";
import type { AddMemberField } from "../../handlers/useGroupDetailHandlers";
import { ActionButton, AmountInput, FieldInput, INPUT_CLASS } from "../ui";

interface Props {
  isVerifying: boolean;
  isAddingMember: boolean;
  handleVerifyUser: (
    email: string,
    setFoundUser: React.Dispatch<React.SetStateAction<{ _id: string; name: string } | null>>,
    setFieldError: ReturnType<typeof useFieldError<AddMemberField>>["setFieldError"],
  ) => Promise<void>;
  handleAddMember: (
    foundUser: { _id: string; name: string } | null,
    memberContrib: string,
    setFoundUser: React.Dispatch<React.SetStateAction<{ _id: string; name: string } | null>>,
    setSearchEmail: React.Dispatch<React.SetStateAction<string>>,
    setMemberContrib: React.Dispatch<React.SetStateAction<string>>,
    setFieldError: ReturnType<typeof useFieldError<AddMemberField>>["setFieldError"],
  ) => Promise<void>;
}

export default function SettingsAddMember({ isVerifying, isAddingMember, handleVerifyUser, handleAddMember }: Props) {
  const { t } = useTranslation();
  const [searchEmail, setSearchEmail] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [foundUser, setFoundUser] = useState<{ _id: string; name: string } | null>(null);
  const [memberContrib, setMemberContrib] = useState("");
  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<AddMemberField>();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedEmail(searchEmail.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchEmail]);

  const { data: suggestions } = useSearchUsersQuery(debouncedEmail, {
    skip: debouncedEmail.length < 2,
  });

  const onSuggestionSelect = (s: UserSuggestion) => {
    setFoundUser({ _id: s._id, name: s.name });
    setSearchEmail(s.email);
    setDebouncedEmail("");
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 relative">
          <FieldInput
            type="email"
            inputMode="email"
            value={searchEmail}
            onChange={(e) => { setSearchEmail(e.target.value); setFoundUser(null); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setShowSuggestions(false)}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyUser(searchEmail, setFoundUser, setFieldError)}
            error={fieldErrors.searchEmail}
            onClearError={() => clearFieldError("searchEmail")}
            placeholder="member@email.com"
            className={INPUT_CLASS}
          />
          {showSuggestions && suggestions && suggestions.length > 0 && (
            <ul className="absolute z-100 left-0 right-0 top-[calc(100%+4px)] bg-[#0d1420] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl shadow-black/40">
              {suggestions.map((s) => (
                <li
                  key={s._id}
                  onMouseDown={(e) => { e.preventDefault(); onSuggestionSelect(s); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.05] cursor-pointer transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-cyan-400" translate="no">
                      {s.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white/85 truncate leading-tight" translate="no">{s.name}</p>
                    <p className="text-[11px] text-white/30 truncate" translate="no">{s.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ActionButton
          tone="neutral"
          fullWidth={false}
          loading={isVerifying}
          loadingLabel={t("groupDetail.settingsFinding")}
          disabled={!searchEmail.trim()}
          onClick={() => handleVerifyUser(searchEmail, setFoundUser, setFieldError)}
          className="px-4 text-xs"
        >
          {t("groupDetail.settingsFind")}
        </ActionButton>
      </div>

      {foundUser && (
        <>
          <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
            <div
              className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/20
                flex items-center justify-center text-[11px] font-bold text-cyan-400 shrink-0"
              translate="no"
            >
              {foundUser.name.slice(0, 2).toUpperCase()}
            </div>
            <p className="text-sm text-white/70" translate="no">{foundUser.name}</p>
          </div>

          <AmountInput
            size="md"
            value={memberContrib}
            onChange={setMemberContrib}
            error={fieldErrors.memberContrib}
            onClearError={() => clearFieldError("memberContrib")}
            placeholder={t("groupDetail.initialContribution")}
            inputClassName={INPUT_CLASS}
          />

          <ActionButton
            tone="cyan"
            loading={isAddingMember}
            loadingLabel={t("groupDetail.addingMember")}
            onClick={() => handleAddMember(foundUser, memberContrib, setFoundUser, setSearchEmail, setMemberContrib, setFieldError)}
          >
            {t("groupDetail.addMemberBtn")}
          </ActionButton>
        </>
      )}
    </div>
  );
}
