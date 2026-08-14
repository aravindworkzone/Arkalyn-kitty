import { useTranslation } from "react-i18next";
import { cn } from "../helpers/cn";

/**
 * Switches between English and Tamil.
 *
 * The label names the language you'd switch TO, not the one you're in.
 *
 * `compact` is the sidebar rail: a single glyph in a 32px square, so it lines up
 * with the theme and notification buttons beside it. At full width "தமிழ்" is
 * five characters and made the rail's utility row visibly ragged.
 *
 * The short forms are written out rather than sliced off the full label —
 * Tamil combines base letters with vowel signs, so taking "the first character"
 * of a Tamil word is only correct by luck and silently wrong for other strings.
 */

interface LanguageToggleProps {
  compact?: boolean;
  className?: string;
}

export default function LanguageToggle({ compact = false, className }: LanguageToggleProps) {
  const { i18n } = useTranslation();
  const isTamil = i18n.language === "ta";

  const toggle = () => {
    const next = isTamil ? "en" : "ta";
    i18n.changeLanguage(next);
    localStorage.setItem("i18n_lang", next);
  };

  const label = isTamil ? "EN" : "தமிழ்";
  const short = isTamil ? "E" : "த";
  const hint = isTamil ? "Switch to English" : "தமிழுக்கு மாறுக";

  return (
    <button
      onClick={toggle}
      title={hint}
      // The compact face is a single glyph, so the accessible name has to carry
      // the meaning the label no longer spells out.
      aria-label={hint}
      className={cn(
        "flex h-8 items-center rounded-lg",
        "bg-surface-hover border border-line text-fg-muted",
        "hover:text-fg active:scale-[0.95] transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        compact ? "w-8 justify-center" : "gap-1 px-2.5",
        className
      )}
    >
      <span className="text-theme-xs font-semibold" translate="no">
        {compact ? short : label}
      </span>
    </button>
  );
}
