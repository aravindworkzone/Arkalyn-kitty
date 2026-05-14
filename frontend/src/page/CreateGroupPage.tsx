import { useState, useEffect } from "react";
import Header from "../components/header";
import { useNavigate } from "react-router-dom";
import type { CreateGroupMember } from "../interface/member";
import { useGroupHandlers, removeMember, updateContribution } from "../handlers/useGroupHandlers";
import type { GroupField } from "../handlers/useGroupHandlers";
import { sanitizeAmount, sanitizeGroupName } from "../helpers/validators";
import { useFieldError } from "../hooks/useFieldError";
import { FieldInput, ErrorMessage } from "../components/ui";
import { useTranslation } from "react-i18next";
import { useSearchUsersQuery, type UserSuggestion } from "../redux/api/user";
import { useGetUserQuery } from "../redux/api/auth";

const s = {
  input:
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-200",
  label:
    "block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-widest",
};

export default function CreateGroupPage() {
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState("");
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
    <div className="min-h-screen bg-[#080c14] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-60 w-[600px] h-[600px] rounded-full bg-indigo-500/4 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <Header />

      <form onSubmit={(e) => handleSubmit(e, groupName, members, currentUser?._id ?? "", setFieldError, setApiError)} className="relative max-w-xl mx-auto px-4 py-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/35 hover:text-white/60 text-xs font-medium transition-colors mb-10 group"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("createGroup.backToGroups")}
        </button>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/70">
              {t("createGroup.newGroup")}
            </p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f0eeff]">
            {t("createGroup.title")}
          </h1>
          <p className="text-white/35 text-sm mt-1.5">
            {t("createGroup.description")}
          </p>
        </div>

        <div className="space-y-3">
          {/* Step 1 — Group name */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]">
              <span className="text-[11px] font-bold text-white/15 tabular-nums">01</span>
              <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                {t("createGroup.step1")}
              </span>
            </div>
            <div className="px-5 py-4">
              <FieldInput
                className={s.input}
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
                <span className="text-[10px] text-white/20 tabular-nums" translate="no">
                  {groupName.length}/30
                </span>
              </div>
            </div>
          </div>

          {/* Step 2 — Members */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-white/15 tabular-nums">02</span>
                <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                  {t("createGroup.step2")}
                </span>
              </div>
              {members.length > 0 && (
                <span className="text-[10px] font-medium text-white/25 bg-white/[0.05] border border-white/[0.07] px-2 py-0.5 rounded-full">
                  {t("createGroup.membersAdded", { count: members.length })}
                </span>
              )}
            </div>

            <div className="px-5 py-4 space-y-4">
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
                    className={s.input}
                    placeholder={t("createGroup.emailPlaceholder")}
                    autoComplete="off"
                  />
                  {showSuggestions && suggestions && suggestions.length > 0 && (
                    <ul className="absolute z-[999] left-0 right-0 top-[calc(100%+4px)] bg-[#0d1420] border border-white/[0.08] rounded-xl shadow-xl shadow-black/40">
                      {suggestions.map((s) => (
                        <li
                          key={s._id}
                          onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(s); }}
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
                <button
                  type="button"
                  onClick={() => addMember(emailInput, members, setFieldError, setApiError, setMembers, setEmailInput)}
                  disabled={isVerifying}
                  className="shrink-0 px-4 py-3 rounded-xl text-sm font-semibold border
                    bg-cyan-500/10 border-cyan-500/25 text-cyan-300
                    hover:bg-cyan-500/20 hover:border-cyan-400/40
                    active:bg-cyan-500/20 active:border-cyan-400/40 active:scale-[0.97]
                    disabled:opacity-40 transition-all duration-150"
                >
                  {isVerifying ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : t("createGroup.add")}
                </button>
              </div>

              {!fieldErrors.emailInput && members.length === 0 && (
                <p className="text-white/20 text-xs">
                  {t("createGroup.emailHint")}
                </p>
              )}

              {members.length > 0 && (
                <div className="space-y-2">
                  {members.map((member, i) => (
                    <div
                      key={member._id}
                      className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5"
                      style={{
                        animation: "fadeSlideIn 0.25s ease forwards",
                        animationDelay: `${i * 40}ms`,
                        opacity: 0,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-bold text-cyan-400" translate="no">
                              {member.user?.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-white/90 truncate leading-tight" translate="no">
                              {member.user}
                            </p>
                            <p className="text-[11px] text-white/30 truncate" translate="no">{member.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {member._id === currentUser?._id ? (
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 text-xs">₹</span>
                              <input
                                className="w-24 bg-white/[0.05] border border-white/[0.09] rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all text-right"
                                defaultValue={member.contribution || ""}
                                placeholder="0"
                                type="text"
                                inputMode="decimal"
                                onChange={(e) => updateContribution(setMembers, member._id, Number(sanitizeAmount(e.target.value)))}
                              />
                            </div>
                          ) : (
                            <>
                              <span className="text-[10px] font-medium text-white/30 bg-white/[0.04] border border-white/[0.07] px-2 py-1 rounded-md">
                                {t("createGroup.invitePending")}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeMember(setMembers, member._id)}
                                className="w-6 h-6 flex items-center justify-center text-white/20 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10"
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
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
                    <span className="text-[10px] text-white/25 uppercase tracking-widest">
                      {t("createGroup.initialPool")}
                    </span>
                    <span className="text-sm font-semibold font-mono text-cyan-300" translate="no">
                      ₹{poolTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {(fieldErrors.members || apiError) && (
          <div className="mt-4 space-y-1.5">
            {fieldErrors.members && <ErrorMessage error={fieldErrors.members} />}
            {apiError && <ErrorMessage error={apiError} />}
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08]
              rounded-xl px-6 py-3 text-sm text-white/40 hover:text-white/60 transition-all"
          >
            {t("createGroup.cancel")}
          </button>
          <button
            type="submit"
            disabled={isLoading || isVerifying}
            className="flex-1 relative overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold
              text-black bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-300 active:scale-[0.97]
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150
              shadow-lg shadow-cyan-500/20"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {t("createGroup.creating")}
              </span>
            ) : t("createGroup.createGroup")}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
