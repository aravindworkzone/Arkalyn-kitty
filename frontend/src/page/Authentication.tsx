import React from 'react'
import { Link } from 'react-router-dom'
import { loginDetails, RegistrationDetails, ErrorRemover } from '../helpers/Authentication'
import { useState } from 'react';
import type { AuthFormProps } from '../interface/auth';
import { useAuthHandlers } from '../handlers/useAuthHandlers';

const Templete = ({inputs, link} : AuthFormProps) => {
    const linkText = link === "register" ? "Don't have an account?" : "Already have an account?";
    const head = link !== "register" ? "Sign up your account" : "Sign in to your account";
    const signButtonText = link !== "register" ? "Sign up" : "Sign in";
    const { handleSubmit, loading } = useAuthHandlers(link);
    const [error, setError] = useState('');
    ErrorRemover(setError);
    return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black relative overflow-hidden">
                <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-[#FFFFFF10] blur-3xl pointer-events-none" />
                <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full bg-[#FFFFFF10] blur-3xl pointer-events-none" />
                <div className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full bg-[#FFFFFF10] blur-3xl pointer-events-none" />
                <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-[#FFFFFF10] blur-3xl pointer-events-none" />
                <div className="relative z-10 w-full max-w-md mx-4 p-10 rounded-2xl bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white font-bold text-base">
                            ₹
                        </div>
                        <span className="text-white/90 font-semibold text-lg tracking-tight">Arkalyn - Fin</span>
                    </div>

                    <h1 className="text-3xl font-bold text-white tracking-tight mb-1">Welcome back</h1>
                    <p className="text-white/40 text-sm mb-8"> {head} </p>

                    <form onSubmit={(e) => handleSubmit(e, setError)} className="flex flex-col gap-5">
                        {
                            Object.keys(inputs).map((key) => {
                                return (
                                    <div className="flex flex-col gap-1.5" key={inputs[key].id}>
                                        <label className="text-white/55 text-xs font-medium tracking-wide">{inputs[key].label}</label>
                                        <input type={key === "password" ? "password" : "text"} name={inputs[key].name} placeholder={inputs[key].placeholder} className="w-full px-4 py-3 rounded-xl bg-white/[0.07] border border-white/10 text-white text-sm placeholder-white/20 outline-none focus:border-violet-500/60 transition-colors" />
                                    </div>
                                )
                            })
                        }
                        {
                            error && <p className="text-red-500 text-sm">{error}</p>
                        }
                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-1 w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white font-semibold text-sm tracking-tight disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity cursor-pointer"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    {signButtonText}ing…
                                </span>
                            ) : signButtonText}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-white/35">
                        {linkText}{" "}
                        <Link to={`/${link}`} className="text-violet-400 font-medium hover:text-violet-300 transition-colors">
                            {link.charAt(0).toUpperCase() + link.slice(1)}
                        </Link>
                    </p>
                </div>
            </div>
    )
}

export const Login = () => {
    return (
        <Templete inputs={loginDetails} link={"register"}/>
    )
}

export const Registration = () => {
    return (
        <Templete inputs={RegistrationDetails} link={"login"}/>
    )
}

