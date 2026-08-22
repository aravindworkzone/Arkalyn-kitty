import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loginDetails, RegistrationDetails } from '../helpers/Authentication'
import { useState } from 'react';
import type { AuthFormProps } from '../interface/auth';
import { useAuthHandlers } from '../handlers/useAuthHandlers';
import type { AuthField } from '../handlers/useAuthHandlers';
import { useFieldError } from '../hooks/useFieldError';
import { FieldInput, ErrorMessage, Logo, StatusBanner } from '../components/ui';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { readBounceReason, clearBounceReason, isBounceLoop } from '../helpers/authBounce';
import AuthLoader from '../components/AuthLoader';
import GoogleButton from '../components/GoogleButton'

// The OAuth callback is a browser redirect, so failures arrive as ?error=<code>
// rather than as a response body. Codes are set by the backend's OAuth handler.
const OAUTH_ERRORS: Record<string, string> = {
    google_denied: "Google sign-in was cancelled.",
    invalid_state: "That sign-in link has expired. Please try again.",
    missing_code: "Google sign-in didn't complete. Please try again.",
    google_unverified: "Your Google email address is not verified.",
    account_suspended: "Your account has been suspended. Contact support.",
    account_conflict: "That email is already linked to a different Google account.",
    // `oauth_failed` is the backend's catch-all for anything it did not expect,
    // and it was missing here — so every unanticipated server-side failure fell
    // through to the generic fallback with no way to tell them apart. The `ref`
    // rendered below is what makes one of these reportable.
    oauth_failed: "Something went wrong signing you in. Please try again.",
    oauth_misconfigured: "Google sign-in is unavailable right now. Please try again later.",
    google_exchange_failed: "We couldn't complete sign-in with Google. Please try again.",
    account_unavailable: "That account is no longer available.",
};

const Templete = ({inputs, link} : AuthFormProps) => {
    const { t } = useTranslation();
    const linkText = link === "register" ? t("auth.noAccount") : t("auth.haveAccount");
    const head = link !== "register" ? t("auth.signUpAccount") : t("auth.signInAccount");
    const signButtonText = link !== "register" ? t("auth.signUp") : t("auth.signIn");
    const { isAuthenticated, isLoading } = useCurrentUser();
    const { handleSubmit, loading } = useAuthHandlers(link);
    const { fieldErrors, setFieldError, clearFieldError } = useFieldError<AuthField>();
    const [apiError, setApiError] = useState('');
    const [bounceReason] = useState(readBounceReason);
    // Read once on mount, alongside the reason it pairs with: the sibling
    // Authentication() effect has given up redirecting, so this page has to stop
    // showing the loader and render itself — banner included.
    const [bounceLoop] = useState(isBounceLoop);
    const [shownPasswords, setShownPasswords] = useState<Record<string, boolean>>({});
    const [searchParams, setSearchParams] = useSearchParams();
    const [oauthError] = useState(() => searchParams.get("error"));
    const [oauthRef] = useState(() => searchParams.get("ref"));
    // Consume the notice once so it doesn't reappear on later visits.
    useEffect(() => {
        if (bounceReason) clearBounceReason();
    }, [bounceReason]);

    // Same idea for the OAuth code: strip it from the URL so a reload or a
    // shared link doesn't resurrect a stale failure message.
    useEffect(() => {
        if (!searchParams.get("error")) return;
        const next = new URLSearchParams(searchParams);
        next.delete("error");
        next.delete("ref");
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);
    const toggleShown = (name: string) =>
        setShownPasswords((prev) => ({ ...prev, [name]: !prev[name] }));
    return (
        <>
        {(isLoading || isAuthenticated) && !bounceLoop ? <AuthLoader /> : (
            <div className="min-h-screen flex flex-col items-center justify-center bg-surface relative overflow-hidden px-5 sm:px-6 py-10 sm:py-14 pt-safe pb-safe">
                <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-line blur-3xl pointer-events-none" />
                <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full bg-line blur-3xl pointer-events-none" />
                <div className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full bg-line blur-3xl pointer-events-none" />
                <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-line blur-3xl pointer-events-none" />
                <div className="relative z-10 w-full max-w-lg p-6 sm:p-10 rounded-2xl bg-surface-hover border border-line shadow-2xl backdrop-blur-xl">

                    <div className="flex items-center justify-center mb-6 gap-3">
                        <Logo variant="mini" className="h-12 w-12 sm:h-16 sm:w-16 rounded-md" />
                        <Logo variant="word" className="h-14 sm:h-18 w-32 sm:w-42 rounded-md" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-fg tracking-tight mb-1">{t("auth.welcome")}</h1>
                    <p className="text-fg-muted text-sm mb-6 sm:mb-8"> {head} </p>

                    {bounceReason && (
                        <div className="mb-5">
                            <StatusBanner
                                status="err"
                                text={
                                    bounceReason === "expired"
                                        ? t("auth.sessionExpired", "Your session expired. Please sign in again.")
                                        : t(
                                              "auth.signInIncomplete",
                                              "We couldn't keep you signed in. If this keeps happening, check that your browser allows cookies for this site."
                                          )
                                }
                            />
                        </div>
                    )}

                    {oauthError && (
                        <div className="mb-5">
                            <StatusBanner
                                status="err"
                                text={
                                    t(
                                        `auth.oauth.${oauthError}`,
                                        OAUTH_ERRORS[oauthError] ?? "Google sign-in failed. Please try again."
                                    ) + (oauthRef ? ` (ref: ${oauthRef})` : "")
                                }
                            />
                        </div>
                    )}

                    <form onSubmit={(e) => handleSubmit(e, setFieldError, setApiError)} className="flex flex-col gap-4 sm:gap-5">
                        {
                            Object.keys(inputs).map((key) => {
                                const field = inputs[key];
                                const isPassword = key === "password" || key === "confirmPassword";
                                const shown = !!shownPasswords[field.name];
                                const inputType = isPassword
                                    ? (shown ? "text" : "password")
                                    : key === "email" ? "email" : "text";
                                const baseClass = "w-full px-4 py-3 rounded-xl bg-surface-hover border border-line text-fg text-base sm:text-sm placeholder:text-fg-subtle outline-none focus:border-brand-500/60 transition-colors";
                                return (
                                    <div className="flex flex-col gap-1.5" key={field.id}>
                                        <label htmlFor={field.id} className="text-fg-muted text-xs font-medium tracking-wide">{t(field.label)}</label>
                                        <div className="relative">
                                            <FieldInput
                                                id={field.id}
                                                type={inputType}
                                                name={field.name}
                                                placeholder={t(field.placeholder)}
                                                autoComplete={field.autoComplete}
                                                inputMode={field.inputMode}
                                                className={isPassword ? `${baseClass} pr-11` : baseClass}
                                                error={fieldErrors[field.name as AuthField]}
                                                onClearError={() => clearFieldError(field.name as AuthField)}
                                            />
                                            {isPassword && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleShown(field.name)}
                                                    aria-label={shown ? t("auth.hidePassword") : t("auth.showPassword")}
                                                    className="absolute top-1/2 -translate-y-1/2 right-2 min-h-touch min-w-touch flex items-center justify-center text-fg-muted hover:text-fg active:text-fg transition-colors"
                                                >
                                                    {shown ? (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                                            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10.9 10.9 0 0112 5c5 0 9 4 10 7-.4 1.1-1.1 2.2-2 3.2M6.1 6.1C4 7.6 2.6 9.7 2 12c1 3 5 7 10 7 1.7 0 3.3-.4 4.7-1.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    ) : (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                                            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        }
                        {apiError && <ErrorMessage error={apiError} />}
                        <div className="space-y-4">
                            <button
                                type="submit"
                                disabled={loading}
                                // The old fill was a gradient whose "from" stop named a
                                // colour Tailwind does not define, so it rendered as
                                // nothing. This is the primary action on the page — it
                                // takes the brand fill, not a neutral one.
                                className="w-full min-h-touch rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 py-3 text-theme-sm font-semibold tracking-tight text-on-accent transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="3"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8v8H4z"
                                            />
                                        </svg>
                                        {signButtonText}…
                                    </span>
                                ) : (
                                    signButtonText
                                )}
                            </button>

                            {/* Divider */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                                </div>

                                <div className="relative flex justify-center">
                                    <span className="bg-surface-raised px-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                                        Or
                                    </span>
                                </div>
                            </div>

                            <GoogleButton />
                        </div>
                    </form>

                    {link === "register" && (
                        <p className="mt-4 text-center">
                            <Link
                                to="/forgot-password"
                                className="text-xs text-fg-muted font-medium hover:text-brand-300 active:text-brand-300 transition-colors"
                            >
                                {t("auth.forgotPassword", "Forgot password?")}
                            </Link>
                        </p>
                    )}

                    <p className="mt-6 text-center text-xs text-fg-muted">
                        {linkText}{" "}
                        <Link to={`/${link}`} className="text-brand-400 font-medium hover:text-brand-300 active:text-brand-300 transition-colors">
                            {link.charAt(0).toUpperCase() + link.slice(1)}
                        </Link>
                    </p>
                </div>
            </div>
        )}
        </>
    )
}

export const Login = () => {
    Authentication();
    return (
        <Templete inputs={loginDetails} link={"register"}/>
    )
}

export const Registration = () => {
    Authentication();
    return (
        <Templete inputs={RegistrationDetails} link={"login"}/>
    )
}

const Authentication = () => {
    const { user, isAuthenticated } = useCurrentUser();
    // Captured during render, not read inside the effect. Templete is a child,
    // and React flushes child effects first — its useCurrentUser clears the
    // counter on a confirmed session, so a live read here would always see zero
    // and redirect anyway.
    const [bounceLoop] = useState(isBounceLoop);
    useEffect(() => {
        if (!isAuthenticated || !user) return;
        // This navigation and the 401 handler in redux/api/base.ts point at each
        // other, and both reload the page. If /user/me answers here but not on
        // the destination — a session cookie the browser stores yet won't send
        // back — the pair spins forever. Stop after a couple of round trips and
        // let the banner above explain, rather than reloading indefinitely.
        if (bounceLoop) return;
        // App owners land on the dashboard; everyone else on their groups.
        window.location.href = user.role === "APP_OWNER" ? "/admin" : "/groups";
    }, [user, isAuthenticated, bounceLoop]);
}
