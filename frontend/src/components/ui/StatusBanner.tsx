interface StatusBannerProps {
  status: "ok" | "err" | null | undefined;
  text: string;
}

export default function StatusBanner({ status, text }: StatusBannerProps) {
  if (!status) return null;
  const ok = status === "ok";
  return (
    <div
      role="status"
      className={`text-theme-xs px-3.5 py-2.5 rounded-xl border ${
        ok
          ? "text-success-700 bg-success-50 border-success-200 dark:text-success-400 dark:bg-success-500/10 dark:border-success-500/20"
          : "text-error-700 bg-error-50 border-error-200 dark:text-error-400 dark:bg-error-500/10 dark:border-error-500/20"
      }`}
    >
      {text}
    </div>
  );
}
