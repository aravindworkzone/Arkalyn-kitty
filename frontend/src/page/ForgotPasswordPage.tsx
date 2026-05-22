import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useForgotPasswordMutation } from "../redux/api/auth";
import { ErrorMessage, Logo } from "../components/ui";

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-white/[0.07] border border-white/10 text-white text-base sm:text-sm placeholder-white/20 outline-none focus:border-violet-500/60 transition-colors";

const buttonClass =
  "mt-1 w-full min-h-touch py-3 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white font-semibold text-sm tracking-tight disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:opacity-90 active:scale-[0.98] transition-all cursor-pointer";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [apiError, setApiError] = useState("");
  const [sent, setSent] = useState(false);
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setApiError("");
    try {
      await forgotPassword({ email: email.trim() }).unwrap();
      setSent(true);
    } catch (err: any) {
      setApiError(err?.data?.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black relative overflow-hidden px-3 sm:px-4 py-6 pt-safe pb-safe">
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-[#FFFFFF10] blur-3xl pointer-events-none" />
      <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full bg-[#FFFFFF10] blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full bg-[#FFFFFF10] blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-[#FFFFFF10] blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-5 sm:p-10 rounded-2xl bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-center mb-6 gap-3">
          <Logo variant="mini" className="h-12 w-12 sm:h-16 sm:w-16 rounded-md" />
          <Logo variant="word" className="h-14 sm:h-18 w-32 sm:w-42 rounded-md" />
        </div>

        {sent ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Check your email</h1>
            <p className="text-white/45 text-sm leading-relaxed mb-6">
              If an account exists for{" "}
              <span className="text-white/70 break-all">{email}</span>, a password reset link is
              on its way. The link expires in 30 minutes — check your spam folder if you don't see
              it.
            </p>
            <Link
              to="/login"
              className="inline-block w-full min-h-touch py-3 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white font-semibold text-sm tracking-tight hover:opacity-90 active:opacity-90 active:scale-[0.98] transition-all"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">
              Forgot password?
            </h1>
            <p className="text-white/40 text-sm mb-6 sm:mb-8">
              Enter the email for your account and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="forgot-email"
                  className="text-white/55 text-xs font-medium tracking-wide"
                >
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  name="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (apiError) setApiError("");
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  className={inputClass}
                />
              </div>

              {apiError && <ErrorMessage error={apiError} />}

              <button type="submit" disabled={isLoading || !email.trim()} className={buttonClass}>
                {isLoading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-white/35">
              Remembered it?{" "}
              <Link
                to="/login"
                className="text-violet-400 font-medium hover:text-violet-300 active:text-violet-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
