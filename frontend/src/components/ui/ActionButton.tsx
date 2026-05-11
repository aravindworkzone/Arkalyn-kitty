import type { ButtonHTMLAttributes, ReactNode } from "react";

export type Tone = "cyan" | "amber" | "violet" | "green" | "red" | "neutral";

interface ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  tone?: Tone;
  loading?: boolean;
  loadingLabel?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
}

const toneMap: Record<Tone, string> = {
  cyan:    "bg-cyan-500/15 border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/25 active:bg-cyan-500/25",
  amber:   "bg-amber-500/15 border-amber-500/25 text-amber-300 hover:bg-amber-500/25 active:bg-amber-500/25",
  violet:  "bg-violet-500/15 border-violet-500/25 text-violet-300 hover:bg-violet-500/25 active:bg-violet-500/25",
  green:   "bg-green-500/15 border-green-500/25 text-green-300 hover:bg-green-500/25 active:bg-green-500/25",
  red:     "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20",
  neutral: "bg-white/[0.04] border-white/[0.09] text-white/50 hover:text-white/80 hover:bg-white/[0.07]",
};

export default function ActionButton({
  tone = "cyan",
  loading = false,
  loadingLabel,
  children,
  fullWidth = true,
  disabled,
  className = "",
  ...rest
}: ActionButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        fullWidth ? "w-full" : "",
        "py-2.5 rounded-xl text-sm font-semibold border",
        "active:scale-[0.97] disabled:opacity-40 transition-all",
        toneMap[tone],
        className,
      ].filter(Boolean).join(" ")}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
