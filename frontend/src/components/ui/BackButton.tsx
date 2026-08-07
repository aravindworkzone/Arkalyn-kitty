import { useNavigate } from "react-router-dom";

interface Props {
  label?: string;
  onClick?: () => void;
}

export default function BackButton({ label = "Back", onClick }: Props) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={onClick ?? (() => navigate(-1))}
      className="flex items-center gap-2 text-fg-muted hover:text-fg active:text-fg text-theme-xs font-medium transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M9 2L4 7l5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </button>
  );
}
