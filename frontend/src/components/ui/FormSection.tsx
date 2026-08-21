import type { ReactNode } from "react";

interface Props {
  step: string;
  title: string;
  children: ReactNode;
  headerRight?: ReactNode;
  contentClass?: string;
  /**
   * Drops the corner-clipping `overflow-hidden` so a popover inside the section
   * can paint past its edge.
   *
   * Needed because `overflow-hidden` clips absolutely-positioned descendants,
   * not just backgrounds: a DatePicker calendar or a Select panel opening near
   * the bottom of a section gets cut off at the border and becomes unusable.
   * Opt-in rather than the default, because the clip is doing real work for
   * sections whose content runs flush to the rounded corners (CreateCategory
   * passes contentClass="" for exactly that).
   */
  allowOverflow?: boolean;
}

/**
 * Numbered form step. Same surface as <Card> but with the step-number eyebrow
 * the multi-step create flows rely on, so it stays separate rather than growing
 * Card a `step` prop.
 */
export default function FormSection({
  step,
  title,
  children,
  headerRight,
  contentClass = "px-5 sm:px-6 py-5",
  allowOverflow = false,
}: Props) {
  return (
    <div
      className={`bg-surface-raised border border-line rounded-2xl shadow-theme-xs ${
        allowOverflow ? "" : "overflow-hidden"
      }`}
    >
      <div
        className={`flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-line ${
          headerRight ? "justify-between" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-theme-xs font-bold text-fg-subtle tabular-nums">{step}</span>
          <span className="text-theme-xs font-semibold text-fg-muted uppercase tracking-widest">{title}</span>
        </div>
        {headerRight}
      </div>
      <div className={contentClass}>{children}</div>
    </div>
  );
}
