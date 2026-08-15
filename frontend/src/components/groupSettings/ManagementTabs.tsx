import type { SettingsTab } from "../../interface/group";

export interface ManagementTabDef {
  id: SettingsTab;
  label: string;
  show: boolean;
}

interface Props {
  tabs: ManagementTabDef[];
  activeTab: SettingsTab;
  onSwitchTab: (tab: SettingsTab) => void;
  ariaLabel: string;
}

/** Stable ids so the tab and its panel can point at each other. */
export const tabId = (id: SettingsTab) => `manage-tab-${id}`;
export const tabPanelId = (id: SettingsTab) => `manage-panel-${id}`;

/**
 * The Group Management tab rail.
 *
 * Successor to components/groupDetail/GroupSettingsSheet.tsx, which carried the
 * same rail inside a modal. As a page the rail no longer owns a backdrop, a
 * header or a close button — it is just the switch — so it sticks below the
 * global header the way page/CategoryReportPage.tsx's view switch does, and
 * stays reachable while the panel below it scrolls.
 */
export default function ManagementTabs({ tabs, activeTab, onSwitchTab, ariaLabel }: Props) {
  return (
    <div
      className="sticky top-14 lg:top-16 z-sticky bg-surface/95 backdrop-blur-md
        -mx-5 sm:-mx-6 lg:-mx-8 xl:-mx-10 px-5 sm:px-6 lg:px-8 xl:px-10"
    >
      <div className="relative border-b border-line">
        <div role="tablist" aria-label={ariaLabel} className="flex overflow-x-auto no-scrollbar gap-1">
          {tabs.filter((tab) => tab.show).map((tab) => (
            <button
              key={tab.id}
              id={tabId(tab.id)}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.id}
              aria-controls={tabPanelId(tab.id)}
              onClick={() => onSwitchTab(tab.id)}
              className={`px-3.5 py-2.5 text-theme-xs font-semibold whitespace-nowrap transition-colors border-b-2
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
        {/* Scroll affordance on narrow viewports; matches the page fill. */}
        <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-surface to-transparent sm:hidden" />
      </div>
    </div>
  );
}
