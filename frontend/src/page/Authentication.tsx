import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginDetails, RegistrationDetails, validators, ErrorRemover } from '../utils/Authentication'
import {useSignUpMutation, useSignInMutation} from '../redux/api/auth'
import { useState } from 'react';
interface Props {
    inputs: Record<string, { placeholder: string, label: string, id: string, name: string }>;
    link: string;
}

const Templete = ({inputs, link} : Props) => {
    const linkText = link === "register" ? "Don't have an account?" : "Already have an account?";
    const head = link !== "register" ? "Sign up your account" : "Sign in to your account";
    const signButtonText = link !== "register" ? "Sign up" : "Sign in";
    const [Auth] = link !== "register" ? useSignUpMutation() : useSignInMutation();
    const navigate = useNavigate();

    const loading = false;
    const [error, setError] = useState('');
    ErrorRemover(setError);
    const HandleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const data: Record<string, string> = {};

        for(const [key, value] of formData.entries()){ 
            if(typeof value == "string") {
                if(key in validators){
                    const validation = validators[key as keyof typeof validators](value as string);
                    if(!validation.valid){
                        setError(validation.message as string);
                        return;
                    }
                }
                data[key] = value;
            }
        };
        try {
            await Auth(data).unwrap();
            setError('');
            navigate('/');
        } catch (error: any) {
            console.log(error);
            setError(error.data?.message || "An error occurred");
        }
    }

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

                    <form onSubmit={HandleSubmit} className="flex flex-col gap-5">
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
                            {loading ? signButtonText+"ing in..." : signButtonText}
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

