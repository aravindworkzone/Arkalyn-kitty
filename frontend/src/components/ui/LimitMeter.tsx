import { useTranslation } from "react-i18next";
import { formatCents, limitStatus } from "../../helpers/money";

interface LimitMeterProps {
  spentCents: number | null | undefined;
  limitCents: number | null | undefined;
  // Hides the "₹200 / ₹1,500" line and leaves just the bar, for tight rows.
  showValues?: boolean;
  // Muted prefix on the values line — used where the surrounding numbers are
  // scoped differently (the report's rows are range-scoped, the limit is not).
  label?: string;
  className?: string;
}

// Progress of a category's lifetime spend against its soft limit — the shared
// "₹200 / ₹1,500" readout used on the category, expense and report screens.
//
// The three states are a status encoding, not a categorical one, so they use the
// success/warning/error tokens and always ship with wording ("₹1,300 left",
// "Over by ₹200") — state is never carried by colour alone.
export default function LimitMeter({
  spentCents,
  limitCents,
  showValues = true,
  label,
  className = "",
}: LimitMeterProps) {
  const { t, i18n } = useTranslation();
  const status = limitStatus(spentCents, limitCents);
  if (!status) return null;

  const { usedPct, state, remainingCents } = status;
  const locale = i18n.language;

  const fill =
    state === "over" ? "bg-error-500" : state === "near" ? "bg-warning-500" : "bg-success-500";
  const noteTone =
    state === "over"
      ? "text-error-600 dark:text-error-400"
      : state === "near"
      ? "text-warning-700 dark:text-warning-400"
      : "text-fg-muted";

  const note =
    state === "over"
      ? t("categoryLimit.over", "Over by {{amount}}", {
          amount: formatCents(Math.abs(remainingCents), locale),
        })
      : t("categoryLimit.left", "{{amount}} left", {
          amount: formatCents(remainingCents, locale),
        });

  return (
    <div className={className}>
      {showValues && (
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-theme-2xs font-mono text-fg-muted min-w-0 truncate" translate="no">
            {label && <span className="font-sans mr-1.5">{label}</span>}
            <span className="text-fg font-semibold">{formatCents(status.spentCents, locale)}</span>
            {" / "}
            {formatCents(status.limitCents, locale)}
          </p>
          <p className={`text-theme-2xs font-medium inline-flex items-center gap-1 ${noteTone}`} translate="no">
            {state !== "under" && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {note}
          </p>
        </div>
      )}
      <div
        className="h-1.5 rounded-full bg-line overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(usedPct, 100))}
        aria-label={t("categoryLimit.progressLabel", "Spend against limit")}
      >
        {/* Clamped at 100% — an overrun is told by the colour and the note, not
            by a bar that runs past its track. A sliver stays visible at 0 spend
            only once something has been spent. */}
        <div
          className={`h-full rounded-full transition-all duration-300 ${fill}`}
          style={{ width: `${Math.min(Math.max(usedPct, usedPct > 0 ? 2 : 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
