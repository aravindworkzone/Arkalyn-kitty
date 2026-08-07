import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useResetPasswordMutation } from "../redux/api/auth";
import { ErrorMessage, Logo } from "../components/ui";

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-surface-hover border border-line text-fg text-base sm:text-sm placeholder:text-fg-subtle outline-none focus:border-brand-500/60 transition-colors";

const buttonClass =
  "mt-1 w-full min-h-touch py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-on-accent font-semibold text-sm tracking-tight disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:opacity-90 active:scale-[0.98] transition-all cursor-pointer";

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-surface relative overflow-hidden px-3 sm:px-4 py-6 pt-safe pb-safe">
    <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-line blur-3xl pointer-events-none" />
    <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full bg-line blur-3xl pointer-events-none" />
    <div className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full bg-line blur-3xl pointer-events-none" />
    <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-line blur-3xl pointer-events-none" />
    <div className="relative z-10 w-full max-w-md p-5 sm:p-10 rounded-2xl bg-surface-hover border border-line shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-center mb-6 gap-3">
        <Logo variant="mini" className="h-12 w-12 sm:h-16 sm:w-16 rounded-md" />
        <Logo variant="word" className="h-14 sm:h-18 w-32 sm:w-42 rounded-md" />
      </div>
      {children}
    </div>
  </div>
);

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [apiError, setApiError] = useState("");
  const [done, setDone] = useState(false);
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldError("");
    setApiError("");
    if (password.length < 6) {
      setFieldError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setFieldError("Passwords do not match");
      return;
    }
    try {
      await resetPassword({ token, password }).unwrap();
      setDone(true);
    } catch (err: any) {
      setApiError(
        err?.data?.message || "Could not reset your password. The link may have expired."
      );
    }
  };

  // No token in the URL — the link was malformed or stripped.
  if (!token) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-fg tracking-tight mb-2">Invalid link</h1>
          <p className="text-fg-muted text-sm leading-relaxed mb-6">
            This password reset link is missing or incomplete. Request a fresh one to continue.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block w-full min-h-touch py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-on-accent font-semibold text-sm tracking-tight hover:opacity-90 active:opacity-90 active:scale-[0.98] transition-all"
          >
            Request a new link
          </Link>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-fg tracking-tight mb-2">Password updated</h1>
          <p className="text-fg-muted text-sm leading-relaxed mb-6">
            Your password has been reset and you've been signed out of all devices. Sign in with
            your new password.
          </p>
          <button onClick={() => navigate("/login")} className={buttonClass}>
            Go to sign in
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl sm:text-3xl font-bold text-fg tracking-tight mb-1">
        Set a new password
      </h1>
      <p className="text-fg-muted text-sm mb-6 sm:mb-8">
        Choose a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-fg-muted text-xs font-medium tracking-wide">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            name="password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldError) setFieldError("");
              if (apiError) setApiError("");
            }}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirm-password"
            className="text-fg-muted text-xs font-medium tracking-wide"
          >
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            name="confirmPassword"
            required
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (fieldError) setFieldError("");
            }}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
            className={inputClass}
          />
        </div>

        {fieldError && <ErrorMessage error={fieldError} />}
        {apiError && <ErrorMessage error={apiError} />}

        <button
          type="submit"
          disabled={isLoading || !password || !confirm}
          className={buttonClass}
        >
          {isLoading ? "Resetting…" : "Reset password"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-fg-muted">
        <Link
          to="/login"
          className="text-brand-400 font-medium hover:text-brand-300 active:text-brand-300 transition-colors"
        >
          Back to sign in
        </Link>
      </p>
    </Shell>
  );
}
