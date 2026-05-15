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
      className="flex items-center gap-2 text-white/35 hover:text-white/60 active:text-white/60 text-xs font-medium transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
