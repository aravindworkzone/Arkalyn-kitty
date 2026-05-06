import { useEffect } from "react";

export const loginDetails = {
    email:{
        placeholder: "Enter your email",
        label: "Email",
        id: "email-login",
        name: "email"
    },
    password: {
        placeholder: "Enter your password",
        label: "Password",
        id: "password-login",
        name: "password"
    }
};

export const RegistrationDetails = {
    name: {
        placeholder: "Enter your name",
        label: "Name",
        id: "name-register",
        name: "name"
    },
    email: {
        placeholder: "Enter your email",
        label: "Email",
        id: "email-register",
        name: "email"
    },
    password: {
        placeholder: "Enter your password",
        label: "Password",
        id: "password-register",
        name: "password"
    }
};

const Success = () => {
    return {valid: true, message: ""};
};

const Fail = ({message}: {message: string}) => {
    return {valid: false, message: message};
};

const validateEmail = (email: string) => {
    if(!email) return Fail({message: "Email is required"});

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(!emailRegex.test(email)) return Fail({message: "Invalid email format"});

    return Success();
};

const validatePassword = (password: string) => {
    if(!password) return Fail({message: "Password is required"});

    if(password.length < 6) return Fail({message: "Password must be at least 6 characters long"});

    return Success();
};

const nameValidation = (name: string) => {
    if(!name) return Fail({message: "Name is required"});

    if(name.trim().length <= 3) return Fail({message: "Name must be at least 4 characters long"});

    return Success();
};

export const validators = {
    email: validateEmail,
    password: validatePassword,
    name: nameValidation
};

export const ErrorRemover = (setError: React.Dispatch<React.SetStateAction<string>>) => {
    useEffect(() => {
        if(setError){
            const handleRemoveError = () => {
                setError('');
            }

            document.addEventListener("input", handleRemoveError);

            return () => document.removeEventListener("input", handleRemoveError);
        }
    }, [setError]);
};
