import { useNavigate } from "react-router-dom";
import Spinner from "./Spinner";

interface Props {
  isLoading: boolean;
  submitLabel: string;
  loadingLabel?: string;
  disabled?: boolean;
  onCancel?: () => void;
}

export default function FormActions({
  isLoading,
  submitLabel,
  loadingLabel,
  disabled,
  onCancel,
}: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex gap-3 pt-1">
      <button
        type="button"
        onClick={onCancel ?? (() => navigate(-1))}
        className="flex-1 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08]
          rounded-xl px-6 py-3 text-sm text-white/40 hover:text-white/60 transition-all"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled ?? isLoading}
        className="flex-1 bg-cyan-400 hover:bg-cyan-300 text-black font-semibold
          rounded-xl px-6 py-3 text-sm transition-all active:scale-[0.98]
          shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner size={16} />
            {loadingLabel ?? `${submitLabel}…`}
          </span>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}
