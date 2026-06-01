import { useState, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCloneGroupMutation } from "../redux/api/group";
import { sanitizeGroupName, validateGroupName } from "../helpers/validators";
import { usePlan } from "../hooks/usePlan";

// Clone a group's structure (categories + member invites) into a fresh group.
// The only thing the user edits is the new group's name — everything else is
// copied automatically and the balance starts empty.
export default function CloneGroupModal({
  isOpen,
  onClose,
  sourceGroupId,
  sourceName,
}: {
  isOpen: boolean;
  onClose: () => void;
  sourceGroupId: string;
  sourceName: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { features } = usePlan();
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
        <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
        <div className="relative w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-[#080c14] px-6 py-6 shadow-2xl text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
            <svg className="h-4 w-4 text-violet-300" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="6.5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5.5 6.5V4.5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </div>
          <h2 className="text-[15px] font-semibold text-white/90">
            {t("cloneGroup.upgradeTitle", "Cloning is a Pro feature")}
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-white/40">
            {t("cloneGroup.upgradeBody", "Upgrade to Pro or Premium to clone a group's categories and members into a fresh group.")}
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-white/70"
            >
              {t("cloneGroup.cancel", "Cancel")}
            </button>
            <button
              onClick={() => { onClose(); navigate("/pricing"); }}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-violet-500/80 border border-violet-500/50 text-white hover:bg-violet-500/90 active:bg-violet-500 transition"
            >
              {t("cloneGroup.viewPlans", "View plans")}
            </button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[460px] rounded-2xl border border-white/[0.08] bg-[#080c14] px-6 py-6 shadow-2xl animate-[fadeUp_0.18s_ease-out]"
      >
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent rounded-full" />

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
            <svg className="h-3.5 w-3.5 text-violet-300" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M3 11V4a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/60">
              {t("cloneGroup.eyebrow", "Clone group")}
            </p>
            <h2 id={titleId} className="text-[15px] font-semibold text-white/90 leading-tight">
              {t("cloneGroup.title", "Clone this group")}
            </h2>
          </div>
        </div>

        <div className="mb-4 h-px bg-white/[0.06]" />

        <p className="mb-4 text-[12px] leading-relaxed text-white/40">
          {t(
            "cloneGroup.description",
            "Categories and member invites will be copied. The new group starts with an empty balance — no expenses or contributions are carried over."
          )}
        </p>

        <div className="mb-5">
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
            {t("cloneGroup.nameLabel", "New group name")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(sanitizeGroupName(e.target.value)); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            autoFocus
            placeholder={t("cloneGroup.namePlaceholder", "Enter a name for the clone")}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/15 outline-none focus:border-violet-500/30 focus:ring-1 focus:ring-violet-500/10 transition-all duration-200"
          />
          <p className="mt-1.5 text-right text-[10px] font-mono text-white/25">{name.length}/30</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-3.5 py-2.5">
            <svg className="h-3.5 w-3.5 shrink-0 text-red-400" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 4.5v3M7 9h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <p className="text-xs text-red-400/80">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-white/70 active:bg-white/[0.09] active:text-white/70"
          >
            {t("cloneGroup.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-150 bg-violet-500/80 border border-violet-500/50 text-white hover:bg-violet-500/90 active:bg-violet-500 disabled:bg-violet-500/[0.08] disabled:border-violet-500/10 disabled:text-violet-300/30 disabled:cursor-not-allowed"
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
