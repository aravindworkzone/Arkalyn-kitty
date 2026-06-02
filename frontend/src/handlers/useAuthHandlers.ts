import { useNavigate } from "react-router-dom";
import { useSignUpMutation, useSignInMutation } from "../redux/api/auth";
import { validators } from "../helpers/validators";
import type { SetFieldError } from "../hooks/useFieldError";

export type AuthField = "email" | "password" | "name" | "confirmPassword";

export const useAuthHandlers = (link: string) => {
  const navigate = useNavigate();
  const [signUp, { isLoading: signUpLoading }] = useSignUpMutation();
  const [signIn, { isLoading: signInLoading }] = useSignInMutation();

  const Auth    = link !== "register" ? signUp      : signIn;
  const loading = link !== "register" ? signUpLoading : signInLoading;
  const login = link === "login";

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
    setFieldError: SetFieldError<AuthField>,
    setApiError:   React.Dispatch<React.SetStateAction<string>>
  ) => {
    e.preventDefault();
    const form     = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data: Record<string, string> = {};
    let valid = true;

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        if (key in validators) {
          const v = validators[key as keyof typeof validators](value);
          if (!v.valid) {
            setFieldError(key as AuthField, v.message);
            valid = false;
          }
        }
        data[key] = value;
      }
    }

    if ("confirmPassword" in data) {
      if (!data.confirmPassword) {
        setFieldError("confirmPassword", "Please confirm your password");
        valid = false;
      } else if (data.password !== data.confirmPassword) {
        setFieldError("confirmPassword", "Passwords do not match");
        valid = false;
      }
      delete data.confirmPassword;
    }

    if (!valid) return;

    try {
      // `data` is built from the form fields; both signUp (name/email/password)
      // and signIn (email/password) accept this shape.
      await Auth(data as { name: string; email: string; password: string }).unwrap();
      setApiError("");
      if(login){
        navigate("/login");
      } else {
        navigate("/groups");
      }
    } catch (error: any) {
      setApiError(error.data?.message || "An error occurred");
    }
  };

  return { handleSubmit, loading };
};
