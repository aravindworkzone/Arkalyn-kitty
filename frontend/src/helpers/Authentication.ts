import { useEffect } from "react";
export { validators } from "./validators";

export const loginDetails = {
  email: {
    placeholder: "auth.fieldEmailPlaceholder",
    label: "auth.fieldEmail",
    id: "email-login",
    name: "email",
  },
  password: {
    placeholder: "auth.fieldPasswordPlaceholder",
    label: "auth.fieldPassword",
    id: "password-login",
    name: "password",
  },
};

export const RegistrationDetails = {
  name: {
    placeholder: "auth.fieldNamePlaceholder",
    label: "auth.fieldName",
    id: "name-register",
    name: "name",
  },
  email: {
    placeholder: "auth.fieldEmailPlaceholder",
    label: "auth.fieldEmail",
    id: "email-register",
    name: "email",
  },
  password: {
    placeholder: "auth.fieldPasswordPlaceholder",
    label: "auth.fieldPassword",
    id: "password-register",
    name: "password",
  },
};

export const ErrorRemover = (
  setError: React.Dispatch<React.SetStateAction<string>>
) => {
  useEffect(() => {
    const handleRemoveError = () => setError("");
    document.addEventListener("input", handleRemoveError);
    return () => document.removeEventListener("input", handleRemoveError);
  }, [setError]);
};
