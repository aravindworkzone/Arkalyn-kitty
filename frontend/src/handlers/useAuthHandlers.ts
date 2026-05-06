import { useNavigate } from "react-router-dom";
import { useSignUpMutation, useSignInMutation } from "../redux/api/auth";
import { validators } from "../helpers/Authentication";

export const useAuthHandlers = (link: string) => {
  const navigate = useNavigate();
  const [signUp, { isLoading: signUpLoading }] = useSignUpMutation();
  const [signIn, { isLoading: signInLoading }] = useSignInMutation();

  const Auth      = link !== "register" ? signUp      : signIn;
  const loading   = link !== "register" ? signUpLoading : signInLoading;

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
    setError: React.Dispatch<React.SetStateAction<string>>
  ) => {
    e.preventDefault();
    const form     = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        if (key in validators) {
          const validation = validators[key as keyof typeof validators](value);
          if (!validation.valid) {
            setError(validation.message as string);
            return;
          }
        }
        data[key] = value;
      }
    }

    try {
      await Auth(data).unwrap();
      setError("");
      navigate("/");
    } catch (error: any) {
      setError(error.data?.message || "An error occurred");
    }
  };

  return { handleSubmit, loading };
};
