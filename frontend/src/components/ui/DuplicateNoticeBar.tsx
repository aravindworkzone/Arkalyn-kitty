import type { DuplicateMatch } from "../../redux/api/expense";
import { useTranslation } from "react-i18next";

interface DuplicateNoticeBarProps {
  match: DuplicateMatch;
}

export default function DuplicateNoticeBar({ match }: DuplicateNoticeBarProps) {
  const { t } = useTranslation();

  const formattedAmount = match.amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedDate = new Date(match.date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="w-full bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <svg
          className="w-4 h-4 mt-0.5 shrink-0 text-amber-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-amber-300">
            {t("duplicateNotice.heading", "Possible duplicate")}
          </p>
          <p className="text-[10px] text-amber-200/70 mt-0.5">
            {t("duplicateNotice.line1", "An expense of ₹{{amount}} already exists on {{date}}.", {
              amount: formattedAmount,
              date: formattedDate,
            })}
          </p>
          {match.title && (
            <p className="text-[10px] text-amber-100/50 mt-1 truncate">
              &ldquo;{match.title}&rdquo; &middot; {match.category.name} &middot; by {match.createdBy.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}