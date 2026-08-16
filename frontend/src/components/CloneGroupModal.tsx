import { useState, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCloneGroupMutation } from "../redux/api/group";
import { sanitizeGroupName, validateGroupName } from "../helpers/validators";
import { useGroupPlan } from "../hooks/usePlan";

// Clone a group's structure (categories + member invites) into a fresh group.
// The only thing the user edits is the new group's name — everything else is
// copied automatically and the balance starts empty.
export default function CloneGroupModal({
  isOpen,
  onClose,
  sourceGroupId,
  sourceName,
  sourceStatus,
}: {
  isOpen: boolean;
  onClose: () => void;
  sourceGroupId: string;
  sourceName: string;
  // Only drives the copy below — whether an upgrade would help. The gate itself
  // is the source group's plan, which already accounts for closure.
  sourceStatus?: "ACTIVE" | "INACTIVE" | "CLOSED";
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Cloning is a paid feature of the SOURCE group — it is that group's structure
  // being copied. A closed source resolves to its frozen snapshot server-side,
  // so this one lookup covers both cases exactly as the backend gate does.
  const { features } = useGroupPlan(sourceGroupId);
  const isClosedSource = sourceStatus === "CLOSED";
  const canClone = features.cloneGroup;
  const [cloneGroup, { isLoading }] = useCloneGroupMutation();

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Pre-fill with "<source> Copy", trimmed/sanitized to the 30-char rule.
  useEffect(() => {
    if (isOpen) {
      setName(sanitizeGroupName(`${sourceName} Copy`));
      setError("");
    }
  }, [isOpen, sourceName]);

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

  // Cloning is a Pro+ feature. Free users see an upgrade prompt instead of the
  // form (the backend enforces this too).
  if (!canClone) {
    return (
      <div className="fixed inset-0 z-modal flex justify-center overflow-y-auto p-4 bg-scrim backdrop-blur-[2px]">
        <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
        <div className="relative my-auto w-full max-w-[420px] rounded-2xl border border-line bg-surface-overlay px-6 py-6 shadow-theme-md text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20">
            <svg className="h-4 w-4 text-brand-600 dark:text-brand-300" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="6.5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5.5 6.5V4.5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </div>
          <h2 className="text-theme-sm font-semibold text-fg">
            {isClosedSource
              ? t("cloneGroup.frozenTitle", "This closed group can't be cloned")
              : t("cloneGroup.upgradeTitle", "Cloning is a Pro feature")}
          </h2>
          <p className="mt-2 text-theme-xs leading-relaxed text-fg-muted">
            {isClosedSource
              ? t("cloneGroup.frozenBody", "This group was on the Free plan when it closed. Its plan is frozen, so it can't be cloned even if you upgrade.")
              : t("cloneGroup.upgradeBody", "Put this group on Pro or Premium to copy its categories and members into a fresh group.")}
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={onClose}
              className={`rounded-xl border border-line bg-surface-raised py-2.5 text-sm font-medium text-fg-muted transition hover:bg-surface-hover hover:text-fg ${isClosedSource ? "w-full" : "flex-1"}`}
            >
              {isClosedSource ? t("cloneGroup.close", "Close") : t("cloneGroup.cancel", "Cancel")}
            </button>
            {!isClosedSource && (
              <button
                onClick={() => { onClose(); navigate(`/pricing?group=${sourceGroupId}`); }}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-brand-50 dark:bg-brand-500/80 border border-brand-200 dark:border-brand-500/50 text-fg hover:bg-brand-50 dark:bg-brand-500/90 active:bg-brand-500 transition"
              >
                {t("cloneGroup.viewPlans", "View plans")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    const check = validateGroupName(name);
    if (!check.valid) {
      setError(check.message);
      return;
    }
    try {
      await cloneGroup({ sourceGroupId, name: name.trim() }).unwrap();
      onClose();
      navigate("/groups");
    } catch (err: any) {
      setError(
        err?.data?.message ||
          t("cloneGroup.error", "Could not clone the group. Please try again.")
      );
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex justify-center overflow-y-auto p-4 bg-scrim backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative my-auto w-full max-w-[460px] rounded-2xl border border-line bg-surface-overlay px-6 py-6 shadow-theme-md animate-[fadeUp_0.18s_ease-out]"
      >
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent rounded-full" />

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20">
            <svg className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M3 11V4a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-theme-2xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-300">
              {t("cloneGroup.eyebrow", "Clone group")}
            </p>
            <h2 id={titleId} className="text-theme-sm font-semibold text-fg leading-tight">
              {t("cloneGroup.title", "Clone this group")}
            </h2>
          </div>
        </div>

        <div className="mb-4 h-px bg-surface-hover" />

        <p className="mb-4 text-theme-xs leading-relaxed text-fg-muted">
          {t(
            "cloneGroup.description",
            "Categories and member invites will be copied. The new group starts with an empty balance — no expenses or contributions are carried over."
          )}
        </p>

        <div className="mb-5">
          <label className="mb-2 block text-theme-2xs font-semibold uppercase tracking-widest text-fg-muted">
            {t("cloneGroup.nameLabel", "New group name")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(sanitizeGroupName(e.target.value)); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            autoFocus
            placeholder={t("cloneGroup.namePlaceholder", "Enter a name for the clone")}
            className="w-full bg-surface-hover border border-line rounded-xl px-4 py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-brand-200 dark:border-brand-500/30 focus:ring-1 focus:ring-brand-500/10 transition-all duration-200"
          />
          <p className="mt-1.5 text-right text-theme-2xs font-mono text-fg-muted">{name.length}/30</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-error-200 dark:border-error-500/15 bg-error-50 dark:bg-error-500/[0.06] px-4 py-3">
            <svg className="h-3.5 w-3.5 shrink-0 text-error-600 dark:text-error-400" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 4.5v3M7 9h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <p className="text-xs text-error-600 dark:text-error-400">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-line bg-surface-raised py-2.5 text-sm font-medium text-fg-muted transition hover:bg-surface-hover hover:text-fg active:bg-surface-hover active:text-fg"
          >
            {t("cloneGroup.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-150 bg-brand-50 dark:bg-brand-500/80 border border-brand-200 dark:border-brand-500/50 text-fg hover:bg-brand-50 dark:bg-brand-500/90 active:bg-brand-500 disabled:bg-brand-50 dark:bg-brand-500/[0.08] disabled:border-brand-200 dark:border-brand-500/10 disabled:text-brand-600 dark:text-brand-300 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 8" />
                </svg>
                {t("cloneGroup.cloning", "Cloning…")}
              </span>
            ) : (
              t("cloneGroup.confirm", "Clone group")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
