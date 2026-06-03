import { useEffect } from "react";
import { useTour } from "./useTour";

/**
 * Final modal shown after the user clicks the last step's target. Matches the
 * existing dark glass aesthetic (white/[0.03] surfaces, cyan / violet accent
 * gradient, subtle blurred ambient blobs).
 */
export default function TourCompletionModal() {
  const { showCompletionModal, dismiss } = useTour();

  useEffect(() => {
    if (!showCompletionModal) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [showCompletionModal, dismiss]);

  if (!showCompletionModal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-complete-title"
      className="fixed inset-0 z-[10050] flex justify-center overflow-y-auto p-4"
      style={{ animation: "tour-fade-in 220ms ease-out forwards" }}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close tour"
        onClick={dismiss}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
      />

      {/* Card */}
      <div
        className="relative my-auto w-full max-w-md rounded-2xl bg-[#0d1220] border border-white/[0.08]
          shadow-[0_24px_80px_rgba(0,0,0,0.55)] overflow-hidden"
        style={{ animation: "tour-pop-in 320ms cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
      >
        {/* Ambient glow blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-16 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        {/* Close (X) */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg
            bg-white/[0.04] text-white/45 hover:text-white/80 hover:bg-white/[0.08]
            active:text-white/80 active:bg-white/[0.08] transition-colors z-10"
        >
          <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="relative px-7 pt-9 pb-7">
          {/* Trophy / sparkle icon */}
          <div className="mx-auto mb-5 w-16 h-16 rounded-2xl
            bg-gradient-to-br from-cyan-400/25 to-violet-500/25
            border border-cyan-300/30 flex items-center justify-center
            shadow-[0_0_40px_rgba(34,211,238,0.25)]">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2l2.39 4.84L20 8l-4 3.9.94 5.5L12 14.77 7.06 17.4 8 11.9 4 8l5.61-1.16L12 2z"
                fill="#fbbf24"
                stroke="#f59e0b"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="text-center text-[11px] font-semibold tracking-widest uppercase text-cyan-400/80 mb-2">
            Tour complete
          </p>
          <h2
            id="tour-complete-title"
            className="text-center text-2xl font-semibold tracking-tight text-[#f0eeff] mb-2"
          >
            You're all set!
          </h2>
          <p className="text-center text-sm text-white/45 mb-7 leading-relaxed">
            That's the core of Arkalyn-Kitty — create a group, add a category, log
            expenses, and track everything in reports. Have fun.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 rounded-xl px-5 py-3 text-sm font-semibold
                bg-white/[0.04] border border-white/[0.08] text-white/55
                hover:bg-white/[0.08] hover:text-white/80
                active:bg-white/[0.08] active:text-white/80 transition-colors"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={dismiss}
              autoFocus
              className="flex-1 rounded-xl px-5 py-3 text-sm font-semibold
                text-black bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-300
                shadow-lg shadow-cyan-500/25 transition-colors active:scale-[0.98]"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tour-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes tour-pop-in {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  );
}
