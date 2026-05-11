interface StatusBannerProps {
  status: "ok" | "err" | null | undefined;
  text: string;
}

export default function StatusBanner({ status, text }: StatusBannerProps) {
  if (!status) return null;
  const ok = status === "ok";
  return (
    <div
      className={`text-xs px-3.5 py-2.5 rounded-xl border ${
        ok
          ? "text-green-400 bg-green-500/10 border-green-500/20"
          : "text-red-400 bg-red-500/10 border-red-500/20"
      }`}
    >
      {text}
    </div>
  );
}
