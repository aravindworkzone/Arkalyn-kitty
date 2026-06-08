import React from 'react'
import { Link } from 'react-router-dom'
import { loginDetails, RegistrationDetails } from '../helpers/Authentication'
import { useState } from 'react';
import type { AuthFormProps } from '../interface/auth';
import { useAuthHandlers } from '../handlers/useAuthHandlers';
import type { AuthField } from '../handlers/useAuthHandlers';
import { useFieldError } from '../hooks/useFieldError';
import { FieldInput, ErrorMessage, Logo } from '../components/ui';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';

const Templete = ({inputs, link} : AuthFormProps) => {
    const { t } = useTranslation();
    const linkText = link === "register" ? t("auth.noAccount") : t("auth.haveAccount");
    const head = link !== "register" ? t("auth.signUpAccount") : t("auth.signInAccount");
    const signButtonText = link !== "register" ? t("auth.signUp") : t("auth.signIn");
    const { isLoading } = useCurrentUser();
    const { handleSubmit, loading } = useAuthHandlers(link);
    const combinedLoading = loading || isLoading;
    const { fieldErrors, setFieldError, clearFieldError } = useFieldError<AuthField>();
    const [apiError, setApiError] = useState('');
    const [shownPasswords, setShownPasswords] = useState<Record<string, boolean>>({});
    const toggleShown = (name: string) =>
        setShownPasswords((prev) => ({ ...prev, [name]: !prev[name] }));
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
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">{t("auth.welcome")}</h1>
                    <p className="text-white/40 text-sm mb-6 sm:mb-8"> {head} </p>

                    <form onSubmit={(e) => handleSubmit(e, setFieldError, setApiError)} className="flex flex-col gap-4 sm:gap-5">
                        {
                            Object.keys(inputs).map((key) => {
                                const field = inputs[key];
                                const isPassword = key === "password" || key === "confirmPassword";
                                const shown = !!shownPasswords[field.name];
                                const inputType = isPassword
                                    ? (shown ? "text" : "password")
                                    : key === "email" ? "email" : "text";
                                const baseClass = "w-full px-4 py-3 rounded-xl bg-white/[0.07] border border-white/10 text-white text-base sm:text-sm placeholder-white/20 outline-none focus:border-violet-500/60 transition-colors";
                                return (
                                    <div className="flex flex-col gap-1.5" key={field.id}>
                                        <label htmlFor={field.id} className="text-white/55 text-xs font-medium tracking-wide">{t(field.label)}</label>
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
                                                    className="absolute top-1/2 -translate-y-1/2 right-2 min-h-touch min-w-touch flex items-center justify-center text-white/40 hover:text-white/70 active:text-white/70 transition-colors"
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
                        <button
                            type="submit"
                            disabled={combinedLoading}
                            className="mt-1 w-full min-h-touch py-3 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white font-semibold text-sm tracking-tight disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                        >
                            {combinedLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    {signButtonText}…
                                </span>
                            ) : signButtonText}
                        </button>
                    </form>

                    {link === "register" && (
                        <p className="mt-4 text-center">
                            <Link
                                to="/forgot-password"
                                className="text-xs text-white/40 font-medium hover:text-violet-300 active:text-violet-300 transition-colors"
                            >
                                {t("auth.forgotPassword", "Forgot password?")}
                            </Link>
                        </p>
                    )}

                    <p className="mt-6 text-center text-xs text-white/35">
                        {linkText}{" "}
                        <Link to={`/${link}`} className="text-violet-400 font-medium hover:text-violet-300 active:text-violet-300 transition-colors">
                            {link.charAt(0).toUpperCase() + link.slice(1)}
                        </Link>
                    </p>
                </div>
            </div>
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
    useEffect(() => {
        if (isAuthenticated && user) {
            // App owners land on the dashboard; everyone else on their groups.
            window.location.href = user.role === "APP_OWNER" ? "/admin" : "/groups";
        }
    }, [user, isAuthenticated]);
}
