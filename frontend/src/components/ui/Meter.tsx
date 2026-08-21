import { cn } from "../../helpers/cn";

/**
 * A plain progress bar: a value out of 100, and nothing else.
 *
 * WHY NOT LimitMeter. That component is a *category spend limit* readout, not a
 * meter — it takes cents, resolves through `limitStatus`, and colours ramps to
 * amber at 80% and red above 100% because on a spend limit, over is bad. On a
 * chit collection the opposite is true: reaching 100% is the goal and over is
 * impossible, so its whole tone vocabulary would be backwards. It also carries
 * its own copy, in the categoryLimit namespace.
 *
 * WHY NOT the inline bar in GroupMembersPanel. That one appears three times in
 * that file already, and it is a bare `div` with a width style — no
 * `role="progressbar"`, no `aria-valuenow`, no label, so it is invisible to a
 * screen reader. Fine as decoration beside a number; not fine as the organiser's
 * primary readout of how collection is going. Giving it those attributes makes it
 * this component.
 *
 * Deliberately dumber than LimitMeter: no money, no i18n, no limit semantics. The
 * caller decides what the number means and which tone says so.
 */

export type MeterTone = "brand" | "success" | "warning" | "error" | "neutral";

interface MeterProps {
  /** 0–100. Clamped here so callers never have to. */
  value: number;
  tone?: MeterTone;
  /** `hair` matches the 2px contribution-share bars; `bar` is a chunkier 6px. */
  size?: "hair" | "bar";
  /** Required — a bar with no accessible name is a decoration, not a readout. */
  ariaLabel: string;
  className?: string;
}

const toneFill: Record<MeterTone, string> = {
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
  neutral: "bg-fg-muted",
};

export default function Meter({
  value,
  tone = "brand",
  size = "bar",
  ariaLabel,
  className,
}: MeterProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={cn(
        "w-full rounded-full bg-line overflow-hidden",
        size === "hair" ? "h-0.5" : "h-1.5",
        className
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-300", toneFill[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
