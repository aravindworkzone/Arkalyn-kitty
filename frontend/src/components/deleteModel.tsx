import { useState, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  confirmText = "DELETE",
  label = "Delete",
  isBlocked = false,
  isLoading = false,
  error = "",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmText?: string;
  label?: string;
  isBlocked?: boolean;
  isLoading?: boolean;
  error?: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const isMatch = inputValue === confirmText;
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) setInputValue("");
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e : KeyboardEvent) => e.key === "Escape" && onClose();
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    return () => { previouslyFocusedRef.current?.focus?.(); };
  }, [isOpen]);

  // Tab trap — confine focus to the dialog while it's open.
  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
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

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 bg-black/75 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative my-auto w-full max-w-[460px] rounded-2xl border border-white/[0.08] bg-[#080c14] px-6 py-6 shadow-2xl animate-[fadeUp_0.18s_ease-out]">

        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent rounded-full" />

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20">
            <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 16 16" fill="none">
              <path d="M6 2h4M3 4h10M5 4l.5 8h5L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/60">
              {t("deleteModal.destructiveAction")}
            </p>
            <h2 id={titleId} className="text-[15px] font-semibold text-white/90 leading-tight">
              {label}
            </h2>
          </div>
        </div>

        <div className="mb-4 h-px bg-white/[0.06]" />

        <div className="mb-4">{children}</div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-3.5 py-2.5">
            <svg className="h-3.5 w-3.5 shrink-0 text-red-400" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 4.5v3M7 9h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <p className="text-xs text-red-400/80">{error}</p>
          </div>
        )}

        {!isBlocked && (
          <div className="mb-5">
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {t("deleteModal.typeToConfirm", { confirmText })
                .split(confirmText)
                .reduce<React.ReactNode[]>((acc, part, i, arr) => {
                  acc.push(part);
                  if (i < arr.length - 1)
                    acc.push(<span key={i} className="font-mono text-red-400/80">{confirmText}</span>);
                  return acc;
                }, [])}
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
              placeholder={confirmText}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 font-mono text-sm tracking-[0.2em] text-white placeholder-white/15 outline-none focus:border-red-500/30 focus:ring-1 focus:ring-red-500/10 transition-all duration-200"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-white/70 active:bg-white/[0.09] active:text-white/70"
          >
            {t("deleteModal.cancel")}
          </button>

          {isBlocked ? (
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-white/40"
            >
              {t("deleteModal.gotIt")}
            </button>
          ) : (
            <button
              onClick={() => isMatch && !isLoading && onConfirm()}
              disabled={!isMatch || isLoading}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-150 ${
                isMatch && !isLoading
                  ? "bg-red-500/80 border border-red-500/50 text-white hover:bg-red-500/90 active:bg-red-500"
                  : "bg-red-500/[0.06] border border-red-500/10 text-red-400/25 cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 8" />
                  </svg>
                  {t("deleteModal.deleting")}
                </span>
              ) : label}
            </button>
          )}
        </div>

        <p className="mt-3.5 text-center text-[10px] font-medium uppercase tracking-widest text-white/15">
          {t("deleteModal.cannotUndo")}
        </p>
      </div>
    </div>
  );
}
