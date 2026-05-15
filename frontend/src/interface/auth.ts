export interface AuthFormProps {
  inputs: Record<
    string,
    {
      placeholder: string;
      label: string;
      id: string;
      name: string;
      autoComplete?: string;
      inputMode?: "text" | "email" | "tel" | "url" | "search" | "numeric" | "decimal" | "none";
    }
  >;
  link: string;
}
