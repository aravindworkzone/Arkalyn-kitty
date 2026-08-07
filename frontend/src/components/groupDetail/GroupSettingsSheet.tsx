import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StatusBanner } from "../ui";
import type { SettingsTab } from "../../interface/group";

interface TabDef {
  id: SettingsTab;
  label: string;
  show: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tabs: TabDef[];
  activeTab: SettingsTab;
  onSwitchTab: (tab: SettingsTab) => void;
  message: { ok: boolean; text: string } | null;
  children: ReactNode;
}

/**
 * The group settings dialog shell — backdrop, header, tab rail, message slot.
 *
 * Kept separate from BottomSheet: this one is wider (sm:max-w-2xl), carries a
 * scrolling tab rail, and its body owns its own padding. Folding both into one
 * component would mean a pile of flags on BottomSheet.
 */
export default function GroupSettingsSheet({
  open,
  onClose,
  tabs,
  activeTab,
  onSwitchTab,
  message,
  children,
}: Props) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-scrim backdrop-blur-sm z-modal"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-modal flex justify-center overflow-y-auto p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("groupDetail.groupSettings")}
          className="my-auto w-full sm:max-w-2xl pointer-events-auto bg-surface-overlay
            border border-line rounded-2xl max-h-[88dvh] flex flex-col shadow-theme-md"
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-line">
            <p className="text-theme-sm font-semibold text-fg">{t("groupDetail.groupSettings")}</p>
            <button
              onClick={onClose}
              aria-label={t("deleteModal.cancel")}
              className="w-7 h-7 flex items-center justify-center rounded-lg
                bg-surface-hover text-fg-muted hover:text-fg hover:bg-line active:text-fg active:bg-line transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="relative border-b border-line shrink-0">
            <div role="tablist" className="flex overflow-x-auto no-scrollbar px-4 pt-2 gap-1">
              {tabs.filter((tab) => tab.show).map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => onSwitchTab(tab.id)}
                  className={`px-3.5 pb-2 text-theme-xs font-semibold whitespace-nowrap transition-colors border-b-2
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40
                    ${activeTab === tab.id
                      ? tab.id === "danger"
                        ? "text-error-600 dark:text-error-400 border-error-500"
                        : "text-brand-600 dark:text-brand-300 border-brand-500"
                      : "text-fg-muted border-transparent hover:text-fg active:text-fg"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Scroll affordance on narrow viewports; matches the sheet fill. */}
            <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-surface-overlay to-transparent sm:hidden" />
          </div>

          <div className="px-5 py-4 space-y-3 flex-1 overflow-y-auto">
            <StatusBanner status={message ? (message.ok ? "ok" : "err") : null} text={message?.text ?? ""} />
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
