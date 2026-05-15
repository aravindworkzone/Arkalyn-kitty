import { useEffect } from "react";

type Tone = "default" | "danger";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Visual accent at the top edge. Use "danger" for destructive flows. */
  tone?: Tone;
  /** Maximum width on tablet/desktop. Defaults to ~460px. */
  maxWidth?: string;
  /** Hide the default header (consumer renders its own). */
  hideHeader?: boolean;
  children: React.ReactNode;
  /** Optional sticky footer (e.g. action buttons) — stays pinned at bottom on mobile. */
  footer?: React.ReactNode;
}

/**
 * Responsive sheet/modal. On mobile (<sm) it slides up from the bottom and
 * occupies full width; on >=sm it centers as a normal modal.
 */
export default function BottomSheet({
  isOpen,
  onClose,
  title,
  tone = "default",
  maxWidth = "max-w-[460px]",
  hideHeader = false,
  children,
  footer,
}: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const accentClass =
    tone === "danger"
      ? "via-red-500/30"
      : "via-white/15";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 sm:backdrop-blur-[2px]"
         style={{ animation: "fadeInBackdrop 0.18s ease-out" }}>
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className={`relative w-full ${maxWidth} sm:w-full bg-[#080c14] border border-white/[0.08]
          rounded-t-2xl sm:rounded-2xl shadow-2xl
          max-h-[92vh] sm:max-h-[85vh] flex flex-col
          pb-safe`}
        style={{
          animation:
            "slideUpSheet 0.22s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {/* drag handle (mobile only) */}
        <div className="flex sm:hidden justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* top accent line */}
        <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent ${accentClass} to-transparent rounded-full pointer-events-none`} />

        {!hideHeader && title && (
          <div className="flex items-center justify-between px-5 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06] shrink-0">
            <p className="text-sm font-semibold text-white/70 truncate pr-3">{title}</p>
            <button
              onClick={onClose}
              aria-label="Close"
              className="min-h-touch min-w-touch sm:min-h-0 sm:min-w-0 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg
                bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08] active:bg-white/[0.08] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        <div className="overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 flex-1">
          {children}
        </div>

        {footer && (
          <div className="border-t border-white/[0.06] px-5 sm:px-6 py-3 sm:py-4 shrink-0 bg-[#080c14] rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
