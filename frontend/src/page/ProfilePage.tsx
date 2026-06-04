import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  useGetUserQuery,
  useSignOutMutation,
  useChangePasswordMutation,
} from "../redux/api/auth";
import { useDeleteAccountMutation } from "../redux/api/user";
import { useGetSubscriptionTransactionsQuery } from "../redux/api/subscription";
import { api } from "../redux/api/base";
import type { AppDispatch } from "../redux/store";
import type { PlanTier, PaymentStatus } from "../interface/subscription";
import { socket } from "../socket/socket";
import { useTour } from "../tour/useTour";
import Header from "../components/header";
import { PageBackground, BackButton } from "../components/ui";

// The /user/me payload — only the slice this page renders.
type ProfileUser = {
  name?: string;
  email?: string;
  createdAt?: string;
  subscription?: { tier: PlanTier; planExpiresAt: string | null };
};

// The literal a user must type to confirm irreversible account deletion.
const DELETE_KEYWORD = "DELETE";

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500 transition-colors";

// Maps a payment status to a badge label + colour for the Transactions list.
const TX_STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  created: { label: "Pending", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  paid:    { label: "Success", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  failed:  { label: "Failed",  cls: "border-red-500/30 bg-red-500/10 text-red-300" },
};

// A tappable settings row with a chevron that rotates open when expanded.
function ChevronRow({
  label,
  hint,
  expanded,
  danger,
  onClick,
}: {
  label: string;
  hint: string;
  expanded: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={
        "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition-colors " +
        (danger
          ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10 active:bg-red-500/10"
          : "border-white/10 bg-white/5 hover:bg-white/10 active:bg-white/10")
      }
    >
      <span className="flex min-w-0 flex-col">
        <span className={"text-sm font-medium " + (danger ? "text-red-300" : "text-white/85")}>
          {label}
        </span>
        <span className="mt-0.5 truncate text-xs text-white/40">{hint}</span>
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className={"shrink-0 transition-transform " + (expanded ? "rotate-90" : "")}
      >
        <path
          d="M5 3l4 4-4 4"
          stroke={danger ? "rgb(252 165 165)" : "rgba(255,255,255,0.4)"}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { start: startTour, reset: resetTour } = useTour();

  // Read the authenticated user straight from the RTK Query store cache — the
  // app's single source of truth for the session (there is no user slice).
  const { data } = useGetUserQuery();
  const user: ProfileUser = data?.data?.user ?? {};

  const [signOut, { isLoading: signingOut }] = useSignOutMutation();
  const [changePassword, { isLoading: changingPassword }] = useChangePasswordMutation();
  const [deleteAccount, { isLoading: deleting }] = useDeleteAccountMutation();

  // ── Password form (plain useState, no form library) ──
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  // ── Subscription transactions (lazy — only fetched when expanded) ──
  const [txOpen, setTxOpen] = useState(false);
  const { data: transactions, isLoading: txLoading } = useGetSubscriptionTransactionsQuery(undefined, { skip: !txOpen });

  // ── Account deletion ──
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // ── Display-layer formatting only ──
  const dateLocale = i18n.language === "ta" ? "ta-IN" : "en-IN";
  const formatMonthYear = (iso: string) =>
    new Intl.DateTimeFormat(dateLocale, { month: "short", year: "numeric" }).format(new Date(iso));
  const formatFullDate = (iso: string) =>
    new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );

  const nameParts = (user.name ?? "").trim().split(/\s+/).filter(Boolean);
  const initials = (
    nameParts.length === 0
      ? "?"
      : nameParts.length === 1
        ? nameParts[0].charAt(0)
        : nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)
  ).toUpperCase();

  const planName = user.subscription?.tier ?? "FREE";
  const renewsAt = user.subscription?.planExpiresAt;

  const switchLanguage = (lng: "en" | "ta") => {
    i18n.changeLanguage(lng);
    localStorage.setItem("i18n_lang", lng);
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (newPassword.length < 6) {
      setPwError(t("profile.passwordMin", "Password must be at least 6 characters"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t("profile.passwordMismatch", "Passwords do not match"));
      return;
    }
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      setPwSuccess(t("profile.passwordChanged", "Password changed successfully"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        t("profile.genericError", "Something went wrong. Please try again.");
      setPwError(message);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    if (confirmText !== DELETE_KEYWORD) return;
    try {
      await deleteAccount().unwrap();
      dispatch(api.util.resetApiState());
      socket.disconnect();
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        t("profile.deleteError", "Could not delete your account.");
      setDeleteError(message);
    }
  };

  const handleTakeTour = () => {
    // Reset progress and (re)start the guided walkthrough from the groups page.
    resetTour();
    startTour();
    navigate("/groups");
  };

  const handleSignOut = async () => {
    try {
      await signOut().unwrap();
    } catch {
      // Even if the network call fails, still clear local state and leave.
    }
    dispatch(api.util.resetApiState());
    socket.disconnect();
    navigate("/login", { replace: true });
  };

  const langButton = (active: boolean) =>
    "px-3 py-1.5 text-xs font-semibold transition-colors " +
    (active ? "bg-violet-500/20 text-violet-200" : "text-white/50 hover:bg-white/10 active:bg-white/10");

  return (
    <div className="relative min-h-screen bg-slate-950 text-white">
      <PageBackground />
      <Header />

      <main className="relative mx-auto w-full max-w-md space-y-6 px-4 pb-24 pt-6">
        <BackButton />

        {/* 1–3. Avatar hero + name/email + joined date */}
        <section className="flex flex-col items-center gap-3 pt-2 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg">
            <span className="text-2xl font-bold text-white" translate="no">
              {initials}
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-white" translate="no">
              {user.name}
            </h1>
            <p className="text-sm text-white/50" translate="no">
              {user.email}
            </p>
            {user.createdAt && (
              <p className="text-xs text-white/30">
                {t("profile.memberSince", "Member since {{date}}", {
                  date: formatMonthYear(user.createdAt),
                })}
              </p>
            )}
          </div>
        </section>

        {/* 6. Subscription strip */}
        <section className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/40">
              {t("profile.subscription", "Subscription")}
            </p>
            <p className="mt-0.5 text-base font-semibold text-white" translate="no">
              {planName}
            </p>
            <p className="mt-0.5 text-xs text-white/40">
              {renewsAt
                ? t("profile.renewsOn", "Renews {{date}}", { date: formatFullDate(renewsAt) })
                : t("profile.noRenewal", "No renewal — free plan")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/pricing")}
            className="shrink-0 rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-500/25 active:bg-violet-500/25"
            translate="no"
          >
            {planName}
          </button>
        </section>

        {/* Subscription transactions (collapsible) */}
        <section className="space-y-3">
          <ChevronRow
            label={t("profile.transactions", "Subscription transactions")}
            hint={t("profile.transactionsDesc", "Your payment history")}
            expanded={txOpen}
            onClick={() => setTxOpen((o) => !o)}
          />
          {txOpen && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              {txLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />
                  ))}
                </div>
              ) : !transactions || transactions.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-white/30">
                  {t("profile.noTransactions", "No payments yet")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {transactions.map((tx) => {
                    const st = TX_STATUS[tx.status];
                    return (
                      <li
                        key={tx.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-white/85" translate="no">
                            {tx.plan} · {tx.cycle}
                          </p>
                          <p className="mt-0.5 text-[11px] text-white/35" translate="no">
                            ₹{tx.amount.toLocaleString("en-IN")} · {formatFullDate(tx.createdAt)}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* 4. Password reset (inline form) + 5. Language switcher */}
        <section className="space-y-3">
          <ChevronRow
            label={t("profile.changePassword", "Change password")}
            hint={t("profile.changePasswordDesc", "Update your account password")}
            expanded={pwOpen}
            onClick={() => {
              setPwOpen((o) => !o);
              setPwError("");
              setPwSuccess("");
            }}
          />
          {pwOpen && (
            <form
              onSubmit={handleChangePassword}
              className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("profile.currentPassword", "Current password")}
                className={INPUT_CLASS}
              />
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("profile.newPassword", "New password")}
                className={INPUT_CLASS}
              />
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("profile.confirmPassword", "Confirm new password")}
                className={INPUT_CLASS}
              />

              {pwError && <p className="text-xs text-red-400">{pwError}</p>}
              {pwSuccess && <p className="text-xs text-emerald-400">{pwSuccess}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPwOpen(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPwError("");
                    setPwSuccess("");
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 active:bg-white/10"
                >
                  {t("profile.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="flex-1 rounded-xl bg-violet-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-400 active:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {changingPassword
                    ? t("profile.saving", "Saving…")
                    : t("profile.savePassword", "Update password")}
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/85">{t("profile.language", "Language")}</p>
              <p className="mt-0.5 text-xs text-white/40">
                {t("profile.languageDesc", "Choose your display language")}
              </p>
            </div>
            <div className="flex shrink-0 overflow-hidden rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => switchLanguage("en")}
                className={langButton(i18n.language === "en")}
                translate="no"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => switchLanguage("ta")}
                className={langButton(i18n.language === "ta")}
                translate="no"
              >
                தமிழ்
              </button>
            </div>
          </div>

          <ChevronRow
            label={t("profile.takeTour", "Take a tour")}
            hint={t("profile.takeTourDesc", "Replay the guided product walkthrough")}
            expanded={false}
            onClick={handleTakeTour}
          />
        </section>

        {/* 8. Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 active:bg-white/10 disabled:opacity-50"
        >
          {signingOut ? t("profile.signingOut", "Signing out…") : t("profile.signOut", "Sign out")}
        </button>

        {/* 7. Account deletion — danger zone */}
        <section className="space-y-3 pt-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-red-400/70">
            {t("profile.dangerZone", "Danger zone")}
          </p>
          <ChevronRow
            danger
            label={t("profile.deleteAccount", "Delete account")}
            hint={t("profile.deleteDesc", "Permanently delete your account and data")}
            expanded={deleteOpen}
            onClick={() => {
              setDeleteOpen((o) => !o);
              setConfirmText("");
              setDeleteError("");
            }}
          />
          {deleteOpen && (
            <div className="space-y-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-xs leading-relaxed text-white/50">
                {t(
                  "profile.deleteWarning",
                  "This cannot be undone. Your account will be removed and you will be signed out.",
                )}
              </p>
              <label className="block text-xs font-medium text-white/50">
                {t("profile.deleteConfirmLabel", 'Type "DELETE" to confirm')}
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={DELETE_KEYWORD}
                className={INPUT_CLASS}
                translate="no"
              />
              {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || confirmText !== DELETE_KEYWORD}
                className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-400 active:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting
                  ? t("profile.deleting", "Deleting…")
                  : t("profile.deleteConfirm", "Delete my account")}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
