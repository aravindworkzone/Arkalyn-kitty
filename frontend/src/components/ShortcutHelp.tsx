import { useTranslation } from "react-i18next";
import { BottomSheet } from "./ui";

interface Row {
  keys: string[];
  label: string;
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd
    className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5
      rounded-md border border-white/[0.12] bg-white/[0.06]
      font-mono text-[11px] font-semibold text-white/70 leading-none shadow-sm"
  >
    {children}
  </kbd>
);

export default function ShortcutHelp({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const navigation: Row[] = [
    { keys: ["G", "G"], label: t("shortcuts.goGroups", "Go to groups list") },
    { keys: ["G", "H"], label: t("shortcuts.goHome", "Go to home") },
    { keys: ["G", "E"], label: t("shortcuts.goExpenses", "Group expenses") },
    { keys: ["G", "A"], label: t("shortcuts.goActivity", "Group activity") },
    { keys: ["G", "R"], label: t("shortcuts.goReports", "Reports / breakdown") },
    { keys: ["G", "C"], label: t("shortcuts.goCredits", "All credits") },
  ];

  const actions: Row[] = [
    { keys: ["N"], label: t("shortcuts.newExpense", "New expense (in current group)") },
    { keys: ["/"], label: t("shortcuts.focusSearch", "Focus search box") },
    { keys: ["Esc"], label: t("shortcuts.close", "Close modal / dialog") },
    { keys: ["?"], label: t("shortcuts.showHelp", "Show this shortcut list") },
  ];

  const renderRow = (row: Row) => (
    <li key={row.keys.join("+") + row.label} className="flex items-center justify-between gap-4 py-2">
      <span className="text-[12px] text-white/65">{row.label}</span>
      <span className="flex items-center gap-1 shrink-0">
        {row.keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-[10px] text-white/25">+
            </span>}
            <Kbd>{k}</Kbd>
          </span>
        ))}
      </span>
    </li>
  );

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("shortcuts.title", "Keyboard shortcuts")}
    >
      <p className="text-[11px] text-white/40 mb-3">
        {t(
          "shortcuts.intro",
          "Use the keyboard to navigate. Shortcuts are ignored while you are typing in a form field."
        )}
      </p>

      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mt-4 mb-1">
        {t("shortcuts.sectionNav", "Navigation")}
      </p>
      <ul className="divide-y divide-white/[0.05]">{navigation.map(renderRow)}</ul>

      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mt-5 mb-1">
        {t("shortcuts.sectionActions", "Actions")}
      </p>
      <ul className="divide-y divide-white/[0.05]">{actions.map(renderRow)}</ul>

      <p className="text-[10px] text-white/30 mt-5">
        {t(
          "shortcuts.tipChord",
          "Press G, then the second key within ~1.5 seconds to navigate."
        )}
      </p>
    </BottomSheet>
  );
}
