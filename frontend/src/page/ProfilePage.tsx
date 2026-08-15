import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  useSignOutMutation,
  useChangePasswordMutation,
} from "../redux/api/auth";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  useDeleteAccountMutation,
  useGenerateApiKeyMutation,
  useRevokeApiKeyMutation,
} from "../redux/api/user";
import {
  useGetSubscriptionTransactionsQuery,
  useDeleteSubscriptionTransactionMutation,
} from "../redux/api/subscription";
import { api } from "../redux/api/base";
import type { AppDispatch } from "../redux/store";
import type { PlanTier, PaymentStatus } from "../interface/subscription";
import { socket } from "../socket/socket";
import { PageBackground, BackButton, PageContainer } from "../components/ui";

// The /user/me payload — only the slice this page renders.
type ProfileUser = {
  name?: string;
  email?: string;
  createdAt?: string;
  subscription?: { tier: PlanTier; planExpiresAt: string | null };
  apiKey?: { prefix: string; createdAt: string | null } | null;
};

// The literal a user must type to confirm irreversible account deletion.
const DELETE_KEYWORD = "DELETE";

// Name + base URL the user pastes into Claude's "Add custom connector" dialog.
// The base is overridable per-deploy; falls back to the hosted MCP server.
const MCP_CONNECTOR_NAME = "Arkalyn Kitty";
const MCP_CONNECTOR_BASE_URL =
  (import.meta.env.VITE_MCP_URL as string | undefined)?.replace(/\/+$/, "") ??
  "https://arkalyn-kitty-mcp.onrender.com/mcp";

const INPUT_CLASS =
  "w-full rounded-xl border border-line bg-surface-hover px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-brand-500 transition-colors";

// Maps a payment status to a badge label + colour for the Transactions list.
const TX_STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  created: { label: "Pending", cls: "border-warning-200 dark:border-warning-500/30 bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-300" },
  paid:    { label: "Success", cls: "border-success-200 dark:border-success-500/30 bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-300" },
  failed:  { label: "Failed",  cls: "border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-600 dark:text-error-400" },
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
          ? "border-error-200 dark:border-error-500/20 bg-error-50 dark:bg-error-500/5 hover:bg-error-50 dark:bg-error-500/10 active:bg-error-50 dark:bg-error-500/10"
          : "border-line bg-surface-hover hover:bg-line active:bg-line")
      }
    >
      <span className="flex min-w-0 flex-col">
        <span className={"text-sm font-medium " + (danger ? "text-error-600 dark:text-error-400" : "text-fg")}>
          {label}
        </span>
        <span className="mt-0.5 truncate text-xs text-fg-muted">{hint}</span>
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

// A labelled read-only value with its own copy button (manages its own
// "Copied" feedback). Used for the connector Name + URL after key generation.
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the value stays selectable for manual copy.
    }
  };
  return (
    <div className="space-y-1">
      <p className="text-theme-xs font-medium uppercase tracking-wide text-fg-muted">{label}</p>
      <div className="flex items-stretch gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface-hover px-3 py-2.5 text-xs text-fg"
          translate="no"
          title={value}
        >
          {value}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-xl border border-brand-200 dark:border-brand-500/40 bg-brand-50 dark:bg-brand-500/15 px-3 text-xs font-semibold text-brand-600 dark:text-brand-300 transition-colors hover:bg-brand-50 dark:bg-brand-500/25 active:bg-brand-50 dark:bg-brand-500/25"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { user: currentUser } = useCurrentUser();
  const user: ProfileUser = currentUser ?? {};

  const [signOut, { isLoading: signingOut }] = useSignOutMutation();
  const [changePassword, { isLoading: changingPassword }] = useChangePasswordMutation();
  const [deleteAccount, { isLoading: deleting }] = useDeleteAccountMutation();
  const [generateApiKey, { isLoading: generatingKey }] = useGenerateApiKeyMutation();
  const [revokeApiKey, { isLoading: revokingKey }] = useRevokeApiKeyMutation();

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
  // Soft-delete: which row is awaiting confirmation, plus the mutation itself.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteTransaction, { isLoading: deletingTx }] = useDeleteSubscriptionTransactionMutation();

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteTransaction({ id }).unwrap();
    } catch {
      // List stays as-is on failure; the Subscription tag wasn't invalidated.
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // ── Account deletion ──
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // ── Developer / API key ──
  const [devOpen, setDevOpen] = useState(false);
  // Holds the plaintext key returned by generate — shown once, kept in memory
  // only (never refetched). Cleared on close/revoke.
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [devError, setDevError] = useState("");

  const handleGenerateKey = async () => {
    setDevError("");
    try {
      const res = await generateApiKey().unwrap();
      setNewKey(res.data.apiKey);
      setKeyCopied(false);
    } catch (err: unknown) {
      setDevError(
        (err as { data?: { message?: string } })?.data?.message ??
          t("profile.genericError", "Something went wrong. Please try again."),
      );
    }
  };

  const handleCopyKey = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setKeyCopied(true);
    } catch {
      // Clipboard blocked (insecure context / permissions) — leave the key
      // visible so the user can select and copy it manually.
    }
  };

  const handleRevokeKey = async () => {
    setDevError("");
    try {
      await revokeApiKey().unwrap();
      setNewKey(null);
      setConfirmRevoke(false);
    } catch (err: unknown) {
      setDevError(
        (err as { data?: { message?: string } })?.data?.message ??
          t("profile.genericError", "Something went wrong. Please try again."),
      );
    }
  };

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
    (active ? "bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300" : "text-fg-muted hover:bg-line active:bg-line");

  return (
    <div className="relative min-h-screen bg-surface text-fg">
      <PageBackground />

      <PageContainer width="form">
        <BackButton />

        {/* 1–3. Avatar hero + name/email + joined date */}
        <section className="flex flex-col items-center gap-3 pt-2 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-700 shadow-lg">
            <span className="text-2xl font-bold text-fg" translate="no">
              {initials}
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-fg" translate="no">
              {user.name}
            </h1>
            <p className="text-sm text-fg-muted" translate="no">
              {user.email}
            </p>
            {user.createdAt && (
              <p className="text-xs text-fg-muted">
                {t("profile.memberSince", "Member since {{date}}", {
                  date: formatMonthYear(user.createdAt),
                })}
              </p>
            )}
          </div>
        </section>

        {/* 6. Subscription strip */}
        <section className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-raised p-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-fg-muted">
              {t("profile.subscription", "Subscription")}
            </p>
            <p className="mt-0.5 text-base font-semibold text-fg" translate="no">
              {planName}
            </p>
            <p className="mt-0.5 text-xs text-fg-muted">
              {renewsAt
                ? t("profile.renewsOn", "Renews {{date}}", { date: formatFullDate(renewsAt) })
                : t("profile.noRenewal", "No renewal — free plan")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/pricing")}
            className="shrink-0 rounded-xl border border-brand-200 dark:border-brand-500/40 bg-brand-50 dark:bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-600 dark:text-brand-300 transition-colors hover:bg-brand-50 dark:bg-brand-500/25 active:bg-brand-50 dark:bg-brand-500/25"
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
            <div className="rounded-2xl border border-line bg-surface-raised p-3">
              {txLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 rounded-xl bg-surface-hover animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />
                  ))}
                </div>
              ) : !transactions || transactions.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-fg-muted">
                  {t("profile.noTransactions", "No payments yet")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {transactions.map((tx) => {
                    const st = TX_STATUS[tx.status];
                    const confirming = confirmDeleteId === tx.id;
                    return (
                      <li
                        key={tx.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-theme-sm font-medium text-fg" translate="no">
                            {tx.plan} · {tx.cycle}
                          </p>
                          <p className="mt-0.5 text-theme-xs text-fg-muted" translate="no">
                            ₹{tx.amount.toLocaleString("en-IN")} · {formatFullDate(tx.createdAt)}
                          </p>
                        </div>
                        {confirming ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteTransaction(tx.id)}
                              disabled={deletingTx}
                              className="rounded-md border border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/15 px-2 py-1 text-theme-2xs font-semibold text-error-600 dark:text-error-400 transition-colors hover:bg-error-50 dark:bg-error-500/25 active:bg-error-50 dark:bg-error-500/25 disabled:opacity-40"
                            >
                              {deletingTx
                                ? t("profile.removing", "Removing…")
                                : t("profile.txRemove", "Remove")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deletingTx}
                              className="rounded-md border border-line bg-surface-hover px-2 py-1 text-theme-2xs font-semibold text-fg-muted transition-colors hover:bg-line active:bg-line disabled:opacity-40"
                            >
                              {t("profile.cancel", "Cancel")}
                            </button>
                          </div>
                        ) : (
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={`rounded-md border px-2 py-0.5 text-theme-2xs font-semibold ${st.cls}`}>
                              {st.label}
                            </span>
                            {
                              tx.status !== "paid" && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(tx.id)}
                                  aria-label={t("profile.txRemoveAria", "Remove from history")}
                                  className="rounded-md p-1 text-fg-muted transition-colors hover:bg-line hover:text-error-600 dark:text-error-400 active:bg-line"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <path
                                      d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m1 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7"
                                      stroke="currentColor"
                                      strokeWidth="1.6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              )
                            }
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Developer — personal API key for the MCP server (read-only access) */}
        <section className="space-y-3">
          <ChevronRow
            label={t("profile.developer", "Developer")}
            hint={t("profile.developerDesc", "API key for read-only programmatic access")}
            expanded={devOpen}
            onClick={() => {
              setDevOpen((o) => !o);
              // Closing hides any freshly shown key and resets transient state.
              setNewKey(null);
              setConfirmRevoke(false);
              setDevError("");
            }}
          />
          {devOpen && (
            <div className="space-y-3 rounded-2xl border border-line bg-surface-raised p-4">
              {newKey ? (
                /* Just generated — one-time reveal with copy + warning. */
                <div className="space-y-2">
                  <p className="text-xs font-medium text-warning-700 dark:text-warning-300">
                    {t(
                      "profile.apiKeyWarning",
                      "This key will not be shown again. Copy and store it now.",
                    )}
                  </p>
                  <div className="flex items-stretch gap-2">
                    <code
                      className="min-w-0 flex-1 break-all rounded-xl border border-line bg-surface-hover px-3 py-2.5 text-xs text-success-700 dark:text-success-300"
                      translate="no"
                    >
                      {newKey}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="shrink-0 rounded-xl border border-brand-200 dark:border-brand-500/40 bg-brand-50 dark:bg-brand-500/15 px-3 text-xs font-semibold text-brand-600 dark:text-brand-300 transition-colors hover:bg-brand-50 dark:bg-brand-500/25 active:bg-brand-50 dark:bg-brand-500/25"
                    >
                      {keyCopied
                        ? t("profile.copied", "Copied")
                        : t("profile.copy", "Copy")}
                    </button>
                  </div>

                  {/* Ready-to-paste values for Claude's "Add custom connector". */}
                  <div className="space-y-3 rounded-xl border border-line bg-surface-raised p-3">
                    <p className="text-theme-xs leading-relaxed text-fg-muted">
                      {t(
                        "profile.mcpConnectorHelp",
                        'In Claude → Add custom connector, paste these into "Name" and "Remote MCP server URL".',
                      )}
                    </p>
                    <CopyField
                      label={t("profile.mcpName", "Name")}
                      value={MCP_CONNECTOR_NAME}
                    />
                    <CopyField
                      label={t("profile.mcpUrl", "Remote MCP server URL")}
                      value={`${MCP_CONNECTOR_BASE_URL}?apiKey=${newKey}`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setNewKey(null)}
                    className="w-full rounded-xl border border-line bg-surface-hover py-2.5 text-sm font-medium text-fg transition-colors hover:bg-line active:bg-line"
                  >
                    {t("profile.apiKeyDone", "Done")}
                  </button>
                </div>
              ) : user.apiKey ? (
                /* A key exists — show masked prefix + revoke. */
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised px-3.5 py-2.5">
                    <code className="min-w-0 truncate text-xs text-fg" translate="no">
                      {user.apiKey.prefix}…
                    </code>
                    <span className="shrink-0 rounded-md border border-success-200 dark:border-success-500/30 bg-success-50 dark:bg-success-500/10 px-2 py-0.5 text-theme-2xs font-semibold text-success-700 dark:text-success-300">
                      {t("profile.apiKeyActive", "Active")}
                    </span>
                  </div>
                  {confirmRevoke ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRevokeKey}
                        disabled={revokingKey}
                        className="flex-1 rounded-xl border border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/15 py-2.5 text-sm font-semibold text-error-600 dark:text-error-400 transition-colors hover:bg-error-50 dark:bg-error-500/25 active:bg-error-50 dark:bg-error-500/25 disabled:opacity-40"
                      >
                        {revokingKey
                          ? t("profile.revoking", "Revoking…")
                          : t("profile.apiKeyConfirmRevoke", "Confirm revoke")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRevoke(false)}
                        disabled={revokingKey}
                        className="flex-1 rounded-xl border border-line bg-surface-hover py-2.5 text-sm font-medium text-fg transition-colors hover:bg-line active:bg-line disabled:opacity-40"
                      >
                        {t("profile.cancel", "Cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRevoke(true)}
                      className="w-full rounded-xl border border-error-200 dark:border-error-500/20 bg-error-50 dark:bg-error-500/5 py-2.5 text-sm font-semibold text-error-600 dark:text-error-400 transition-colors hover:bg-error-50 dark:bg-error-500/10 active:bg-error-50 dark:bg-error-500/10"
                    >
                      {t("profile.apiKeyRevoke", "Revoke API key")}
                    </button>
                  )}
                </div>
              ) : (
                /* No key yet — offer to generate one. */
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-fg-muted">
                    {t(
                      "profile.apiKeyIntro",
                      "Generate a key to connect Arkalyn Kitty to Claude (MCP). It grants read-only access to your own groups, expenses, members, and subscription.",
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateKey}
                    disabled={generatingKey}
                    className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-brand-400 active:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {generatingKey
                      ? t("profile.generating", "Generating…")
                      : t("profile.apiKeyGenerate", "Generate API Key")}
                  </button>
                </div>
              )}
              {devError && <p className="text-xs text-error-600 dark:text-error-400">{devError}</p>}
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
              className="space-y-3 rounded-2xl border border-line bg-surface-raised p-4"
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

              {pwError && <p className="text-xs text-error-600 dark:text-error-400">{pwError}</p>}
              {pwSuccess && <p className="text-xs text-success-700 dark:text-success-300">{pwSuccess}</p>}

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
                  className="flex-1 rounded-xl border border-line bg-surface-hover py-2.5 text-sm font-medium text-fg transition-colors hover:bg-line active:bg-line"
                >
                  {t("profile.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-brand-400 active:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {changingPassword
                    ? t("profile.saving", "Saving…")
                    : t("profile.savePassword", "Update password")}
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-raised p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">{t("profile.language", "Language")}</p>
              <p className="mt-0.5 text-xs text-fg-muted">
                {t("profile.languageDesc", "Choose your display language")}
              </p>
            </div>
            <div className="flex shrink-0 overflow-hidden rounded-xl border border-line">
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

        </section>

        {/* 8. Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full rounded-2xl border border-line bg-surface-hover px-4 py-4 text-sm font-medium text-fg transition-colors hover:bg-line active:bg-line disabled:opacity-50"
        >
          {signingOut ? t("profile.signingOut", "Signing out…") : t("profile.signOut", "Sign out")}
        </button>

        {/* 7. Account deletion — danger zone */}
        <section className="space-y-3 pt-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-error-600 dark:text-error-400">
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
            <div className="space-y-3 rounded-2xl border border-error-200 dark:border-error-500/20 bg-error-50 dark:bg-error-500/5 p-4">
              <p className="text-xs leading-relaxed text-fg-muted">
                {t(
                  "profile.deleteWarning",
                  "This cannot be undone. Your account will be removed and you will be signed out.",
                )}
              </p>
              <label className="block text-xs font-medium text-fg-muted">
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
              {deleteError && <p className="text-xs text-error-600 dark:text-error-400">{deleteError}</p>}
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || confirmText !== DELETE_KEYWORD}
                className="w-full rounded-xl bg-error-500 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-error-400 active:bg-error-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting
                  ? t("profile.deleting", "Deleting…")
                  : t("profile.deleteConfirm", "Delete my account")}
              </button>
            </div>
          )}
        </section>
      </PageContainer>
    </div>
  );
}
