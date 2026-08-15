import { useState, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Label } from "./ui";

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
  const inputId = useId();
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
    <div className="fixed inset-0 z-modal flex justify-center overflow-y-auto p-4 bg-scrim backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative my-auto w-full max-w-[460px] rounded-2xl border border-line bg-surface-overlay px-6 py-6 shadow-theme-md animate-[fadeUp_0.18s_ease-out]">

        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-error-500/30 to-transparent rounded-full" />

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-error-50 border border-error-200 dark:bg-error-500/10 dark:border-error-500/20">
            <svg className="h-3.5 w-3.5 text-error-600 dark:text-error-400" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 2h4M3 4h10M5 4l.5 8h5L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-theme-2xs font-bold uppercase tracking-widest text-error-600 dark:text-error-400">
              {t("deleteModal.destructiveAction")}
            </p>
            <h2 id={titleId} className="text-theme-sm font-semibold text-fg leading-tight">
              {label}
            </h2>
          </div>
        </div>

        <div className="mb-4 h-px bg-line" />

        <div className="mb-4">{children}</div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 dark:border-error-500/15 dark:bg-error-500/[0.06] px-4 py-3">
            <svg className="h-3.5 w-3.5 shrink-0 text-error-600 dark:text-error-400" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 4.5v3M7 9h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <p className="text-theme-xs text-error-700 dark:text-error-400/80">{error}</p>
          </div>
        )}

        {!isBlocked && (
          <div className="mb-5">
            <Label htmlFor={inputId}>
              {t("deleteModal.typeToConfirm", { confirmText })
                .split(confirmText)
                .reduce<React.ReactNode[]>((acc, part, i, arr) => {
                  acc.push(part);
                  if (i < arr.length - 1)
                    acc.push(<span key={i} className="font-mono text-error-600 dark:text-error-400">{confirmText}</span>);
                  return acc;
                }, [])}
            </Label>
            <Input
              id={inputId}
              type="text"
              rawValue
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
              placeholder={confirmText}
              className="font-mono tracking-[0.2em]"
            />
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth className="flex-1" onClick={onClose}>
            {t("deleteModal.cancel")}
          </Button>

          {isBlocked ? (
            <Button variant="secondary" fullWidth className="flex-1" onClick={onClose}>
              {t("deleteModal.gotIt")}
            </Button>
          ) : (
            <Button
              variant="destructive"
              fullWidth
              className="flex-1"
              onClick={() => isMatch && !isLoading && onConfirm()}
              disabled={!isMatch}
              loading={isLoading}
              loadingLabel={t("deleteModal.deleting")}
            >
              {label}
            </Button>
          )}
        </div>

        <p className="mt-3.5 text-center text-theme-2xs font-medium uppercase tracking-widest text-fg-muted">
          {t("deleteModal.cannotUndo")}
        </p>
      </div>
    </div>
  );
}
