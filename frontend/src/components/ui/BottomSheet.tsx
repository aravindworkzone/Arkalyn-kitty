import { useEffect, useId, useRef } from "react";

type Tone = "default" | "danger";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  tone?: Tone;
  maxWidth?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

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
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Freeze background scroll while open.
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

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const node = sheetRef.current;
    if (node) {
      const firstFocusable = node.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      (firstFocusable ?? node).focus();
    }
    return () => { previouslyFocusedRef.current?.focus?.(); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const node = sheetRef.current;
      if (!node) return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  const accentClass = tone === "danger" ? "via-red-500/30" : "via-white/15";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 bg-black/75 backdrop-blur-[2px]"
      style={{ animation: "fadeInBackdrop 0.18s ease-out" }}
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative my-auto w-full ${maxWidth} bg-[#080c14] border border-white/[0.08]
          rounded-2xl shadow-2xl max-h-[88dvh] flex flex-col outline-none
          animate-[fadeUp_0.18s_ease-out]`}
      >
        {/* top accent line */}
        <div
          className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent ${accentClass} to-transparent rounded-full pointer-events-none`}
        />

        {!hideHeader && title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0">
            <p id={titleId} className="text-sm font-semibold text-white/70 truncate pr-3">
              {title}
            </p>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-lg
                bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08]
                active:bg-white/[0.08] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>

        {footer && (
          <div className="border-t border-white/[0.06] px-5 py-3 shrink-0 bg-[#080c14] rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
