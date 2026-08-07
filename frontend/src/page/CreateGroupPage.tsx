import { useState, useEffect } from "react";
import Header from "../components/header";
import { useNavigate } from "react-router-dom";
import type { CreateGroupMember } from "../interface/member";
import { useGroupHandlers, removeMember, updateContribution } from "../handlers/useGroupHandlers";
import type { GroupField } from "../handlers/useGroupHandlers";
import { sanitizeAmount, sanitizeGroupName } from "../helpers/validators";
import { useFieldError } from "../hooks/useFieldError";
import {
  Button,
  ErrorMessage,
  FieldInput,
  FormSection,
  INPUT_CLASS,
  Input,
  PageBackground,
  PageHeader,
  Spinner,
} from "../components/ui";
import { useTranslation } from "react-i18next";
import { useSearchUsersQuery, type UserSuggestion } from "../redux/api/user";
import { useGetUserQuery } from "../redux/api/auth";

const PURPOSE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "FAMILY",    label: "Family",    hint: "Household & shared bills" },
  { value: "FRIENDS",   label: "Friends",   hint: "Outings & trips" },
  { value: "ROOMMATES", label: "Roommates", hint: "Rent & utilities" },
  { value: "TEAM",      label: "Team",      hint: "Work & events" },
  { value: "OTHER",     label: "Other",     hint: "Start blank" },
];

export default function CreateGroupPage() {
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState("");
  const [purpose, setPurpose] = useState("OTHER");
  const [members, setMembers] = useState<CreateGroupMember[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const { data: meData } = useGetUserQuery();
  const currentUser = meData?.data?.user as { _id: string; name: string; email: string } | undefined;

  useEffect(() => {
    if (!currentUser?._id) return;
    setMembers((prev) => {
      if (prev.some((m) => m._id === currentUser._id)) return prev;
      return [{ _id: currentUser._id, user: currentUser.name, email: currentUser.email, contribution: 0 }, ...prev];
    });
  }, [currentUser?._id, currentUser?.name, currentUser?.email]);
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { fieldErrors, setFieldError, clearFieldError } = useFieldError<GroupField>();
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedEmail(emailInput.trim()), 300);
    return () => clearTimeout(t);
  }, [emailInput]);

  const { data: suggestions } = useSearchUsersQuery(debouncedEmail, {
    skip: debouncedEmail.length < 2,
  });

  const handleSuggestionSelect = (s: UserSuggestion) => {
    if (members.some((m) => m.email === s.email)) {
      setFieldError("emailInput", "Member already added");
      setShowSuggestions(false);
      return;
    }
    setMembers((prev) => [...prev, { _id: s._id, user: s.name, contribution: 0, email: s.email }]);
    setEmailInput("");
    setDebouncedEmail("");
    setShowSuggestions(false);
  };

  const navigate = useNavigate();
  const { addMember, handleSubmit, isLoading, isVerifying } = useGroupHandlers();

  const poolTotal = members.find((m) => m._id === currentUser?._id)?.contribution || 0;

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />

      <Header />

      <form onSubmit={(e) => handleSubmit(e, groupName, members, currentUser?._id ?? "", setFieldError, setApiError, purpose)} className="relative max-w-xl mx-auto px-4 pt-8 pb-18">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-fg-muted hover:text-fg active:text-fg text-theme-xs font-medium transition-colors mb-10 group
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("createGroup.backToGroups")}
        </button>

        <PageHeader
          accent="brand"
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          label={t("createGroup.newGroup")}
          title={t("createGroup.title")}
          description={t("createGroup.description")}
        />

        <div className="space-y-3">
          {/* Step 1 — Group name */}
          <FormSection step="01" title={t("createGroup.step1")}>
            <FieldInput
              className={INPUT_CLASS}
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(sanitizeGroupName(e.target.value))}
              error={fieldErrors.groupName}
              onClearError={() => clearFieldError("groupName")}
              placeholder={t("createGroup.groupNamePlaceholder")}
              autoComplete="off"
              maxLength={30}
            />
            <div className="flex justify-end mt-1.5">
              <span className="text-theme-2xs text-fg-muted tabular-nums" translate="no">
                {groupName.length}/30
              </span>
            </div>
          </FormSection>

          {/* Step 2 — Purpose */}
          <FormSection step="02" title={t("createGroup.purposeStep", "Purpose")}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PURPOSE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPurpose(opt.value)}
                  aria-pressed={purpose === opt.value}
                  className={`text-left rounded-xl border px-3 py-2.5 transition-all duration-150
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                    purpose === opt.value
                      ? "bg-brand-50 border-brand-300 dark:bg-brand-500/15 dark:border-brand-500/35"
                      : "bg-surface-raised border-line hover:border-line-strong"
                  }`}
                >
                  <p className={`text-theme-sm font-semibold leading-tight ${purpose === opt.value ? "text-brand-700 dark:text-brand-200" : "text-fg"}`} translate="no">
                    {t(`createGroup.purpose.${opt.value}`, opt.label)}
                  </p>
                  <p className="text-theme-2xs text-fg-muted mt-0.5" translate="no">
                    {t(`createGroup.purposeHint.${opt.value}`, opt.hint)}
                  </p>
                </button>
              ))}
            </div>
            <p className="text-theme-2xs text-fg-muted mt-2.5">
              {t("createGroup.purposeNote", "We'll add a starter set of categories for this purpose. You can edit them anytime.")}
            </p>
          </FormSection>

          {/* Step 3 — Members */}
          <FormSection
            step="03"
            title={t("createGroup.step2")}
            contentClass="px-5 py-4 space-y-4"
            headerRight={
              members.length > 0 ? (
                <span className="text-theme-2xs font-medium text-fg-muted bg-surface-hover border border-line px-2 py-0.5 rounded-full">
                  {t("createGroup.membersAdded", { count: members.length })}
                </span>
              ) : undefined
            }
          >
              <div className="flex items-start gap-2">
                <div className="flex-1 relative">
                  <FieldInput
                    type="email"
                    inputMode="email"
                    value={emailInput}
                    onChange={(e) => { setEmailInput(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setShowSuggestions(false)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMember(emailInput, members, setFieldError, setApiError, setMembers, setEmailInput))}
                    error={fieldErrors.emailInput}
                    onClearError={() => clearFieldError("emailInput")}
                    className={INPUT_CLASS}
                    placeholder={t("createGroup.emailPlaceholder")}
                    autoComplete="off"
                  />
                  {showSuggestions && suggestions && suggestions.length > 0 && (
                    <ul className="absolute z-dropdown left-0 right-0 top-[calc(100%+4px)] bg-surface-overlay border border-line rounded-xl shadow-theme-md overflow-hidden">
                      {suggestions.map((s) => (
                        <li
                          key={s._id}
                          onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(s); }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover cursor-pointer transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full bg-brand-50 border border-brand-200 dark:bg-brand-500/15 dark:border-brand-500/20 flex items-center justify-center shrink-0">
                            <span className="text-theme-2xs font-bold text-brand-600 dark:text-brand-400" translate="no">
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => addMember(emailInput, members, setFieldError, setApiError, setMembers, setEmailInput)}
                  disabled={isVerifying}
                  className="shrink-0 py-3"
                >
                  {isVerifying ? <Spinner size={16} /> : t("createGroup.add")}
                </Button>
              </div>

              {!fieldErrors.emailInput && members.length === 0 && (
                <p className="text-fg-muted text-theme-xs">
                  {t("createGroup.emailHint")}
                </p>
              )}

              {members.length > 0 && (
                <div className="space-y-2">
                  {members.map((member, i) => (
                    <div
                      key={member._id}
                      className="bg-surface-raised border border-line rounded-xl p-3.5"
                      style={{
                        animation: "fadeSlideIn 0.25s ease forwards",
                        animationDelay: `${i * 40}ms`,
                        opacity: 0,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 dark:bg-brand-500/15 dark:border-brand-500/20 flex items-center justify-center shrink-0">
                            <span className="text-theme-xs font-bold text-brand-600 dark:text-brand-400" translate="no">
                              {member.user?.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-theme-sm font-medium text-fg truncate leading-tight" translate="no">
                              {member.user}
                            </p>
                            <p className="text-theme-xs text-fg-muted truncate" translate="no">{member.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {member._id === currentUser?._id ? (
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted text-theme-xs">₹</span>
                              <Input
                                size="sm"
                                className="w-24 pl-6 text-right"
                                defaultValue={member.contribution || ""}
                                placeholder="0"
                                type="text"
                                inputMode="decimal"
                                aria-label={t("createGroup.initialPool")}
                                onChange={(e) => updateContribution(setMembers, member._id, Number(sanitizeAmount(e.target.value)))}
                              />
                            </div>
                          ) : (
                            <>
                              <span className="text-theme-2xs font-medium text-fg-muted bg-surface-hover border border-line px-2 py-1 rounded-md">
                                {t("createGroup.invitePending")}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeMember(setMembers, member._id)}
                                aria-label={t("createGroup.removeMember", "Remove member")}
                                className="w-6 h-6 flex items-center justify-center text-fg-muted rounded-md transition-colors
                                  hover:text-error-600 hover:bg-error-50 active:text-error-600 active:bg-error-50
                                  dark:hover:text-error-400 dark:hover:bg-error-500/10 dark:active:text-error-400 dark:active:bg-error-500/10"
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                  <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between px-1 pt-1">
                    <span className="text-theme-2xs text-fg-muted uppercase tracking-widest">
                      {t("createGroup.initialPool")}
                    </span>
                    <span className="text-theme-sm font-semibold font-mono text-brand-600 dark:text-brand-300" translate="no">
                      ₹{poolTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              )}
          </FormSection>
        </div>

        {(fieldErrors.members || apiError) && (
          <div className="mt-4 space-y-1.5">
            {fieldErrors.members && <ErrorMessage error={fieldErrors.members} />}
            {apiError && <ErrorMessage error={apiError} />}
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            className="flex-1 py-3"
            onClick={() => navigate(-1)}
          >
            {t("createGroup.cancel")}
          </Button>
          <Button
            type="submit"
            fullWidth
            className="flex-1 py-3"
            loading={isLoading}
            loadingLabel={t("createGroup.creating")}
            disabled={isVerifying}
          >
            {t("createGroup.createGroup")}
          </Button>
        </div>
      </form>
    </div>
  );
}
