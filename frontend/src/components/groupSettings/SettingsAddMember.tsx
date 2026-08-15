import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFieldError } from "../../hooks/useFieldError";
import { useSearchUsersQuery, type UserSuggestion } from "../../redux/api/user";
import type { AddMemberField } from "../../handlers/useGroupDetailHandlers";
import { ActionButton, FieldInput, INPUT_CLASS } from "../ui";

interface Props {
  isVerifying: boolean;
  isInvitingMember: boolean;
  handleVerifyUser: (
    email: string,
    setFoundUser: React.Dispatch<React.SetStateAction<{ _id: string; name: string } | null>>,
    setFieldError: ReturnType<typeof useFieldError<AddMemberField>>["setFieldError"],
  ) => Promise<void>;
  handleInviteMember: (
    foundUser: { _id: string; name: string } | null,
    setFoundUser: React.Dispatch<React.SetStateAction<{ _id: string; name: string } | null>>,
    setSearchEmail: React.Dispatch<React.SetStateAction<string>>,
  ) => Promise<void>;
}

export default function SettingsAddMember({ isVerifying, isInvitingMember, handleVerifyUser, handleInviteMember }: Props) {
  const { t } = useTranslation();
  const [searchEmail, setSearchEmail] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [foundUser, setFoundUser] = useState<{ _id: string; name: string } | null>(null);
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
            // Delay the hide so a tap on a suggestion (which blurs the input
            // first on touch devices) still registers before the list unmounts.
            onBlur={() => { window.setTimeout(() => setShowSuggestions(false), 150); }}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyUser(searchEmail, setFoundUser, setFieldError)}
            error={fieldErrors.searchEmail}
            onClearError={() => clearFieldError("searchEmail")}
            placeholder="member@email.com"
            className={INPUT_CLASS}
          />
          {/* Only surface results for an active search (≥2 chars) — never a stale
              or unfiltered list. */}
          {showSuggestions && debouncedEmail.length >= 2 && suggestions && suggestions.length > 0 && (
            <ul className="absolute z-dropdown left-0 right-0 top-[calc(100%+4px)] bg-surface-overlay border border-line rounded-xl overflow-hidden shadow-theme-md">
              {suggestions.map((s) => (
                <li
                  key={s._id}
                  onMouseDown={(e) => { e.preventDefault(); onSuggestionSelect(s); }}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover cursor-pointer transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-50 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-500/20 flex items-center justify-center shrink-0">
                    <span className="text-theme-2xs font-bold text-brand-600 dark:text-brand-300" translate="no">
                      {s.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-theme-sm font-medium text-fg truncate leading-tight" translate="no">{s.name}</p>
                    <p className="text-theme-xs text-fg-muted truncate" translate="no">{s.email}</p>
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
          <div className="flex items-center gap-3 px-5 py-3.5 bg-surface-raised border border-line rounded-xl">
            <div
              className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-500/20
                flex items-center justify-center text-theme-xs font-bold text-brand-600 dark:text-brand-300 shrink-0"
              translate="no"
            >
              {foundUser.name.slice(0, 2).toUpperCase()}
            </div>
            <p className="text-sm text-fg" translate="no">{foundUser.name}</p>
          </div>

          <p className="text-theme-xs text-fg-muted px-0.5">{t("groupDetail.inviteMemberHint")}</p>

          <ActionButton
            tone="brand"
            loading={isInvitingMember}
            loadingLabel={t("groupDetail.invitingMember")}
            onClick={() => handleInviteMember(foundUser, setFoundUser, setSearchEmail)}
          >
            {t("groupDetail.inviteMemberBtn")}
          </ActionButton>
        </>
      )}
    </div>
  );
}
