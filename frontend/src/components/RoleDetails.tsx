import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { roleGrade, roleNs } from "../helpers/constants";
import { type Group } from "../interface/group";

type Role = Group["role"];

interface RoleDetailsProps {
  /** Tab to open on first render. */
  role?: Role;
  /** Eyebrow above the tabs — omitted when absent. */
  groupName?: string;
}

interface Rule {
  /** Translation key. */
  text: string;
  allowed: boolean;
}

interface Section {
  /** Translation key. */
  heading: string;
  rules: Rule[];
  /** Dims the rows — used for capabilities inherited from a lower role. */
  muted?: boolean;
}

interface Panel {
  /** Translation key. */
  summary: string;
  sections: Section[];
  note?: { text: string; tone: "warn" | "muted" };
}

const TAB_ORDER: Role[] = ["SUPER_ADMIN", "ADMIN", "MEMBER"];

// Full class strings — Tailwind cannot resolve interpolated class names.
const TAB_ACTIVE: Record<Role, string> = {
  SUPER_ADMIN: "bg-brand-50 dark:bg-brand-500/[0.13] text-brand-600 dark:text-brand-300",
  ADMIN: "bg-warning-400/[0.13] text-warning-700 dark:text-warning-300",
  MEMBER: "bg-surface-hover text-fg-muted",
};

const TAB_RING: Record<Role, string> = {
  SUPER_ADMIN: "focus-visible:ring-brand-400/60",
  ADMIN: "focus-visible:ring-warning-400/60",
  MEMBER: "focus-visible:ring-brand-500/40",
};

// Every rule below mirrors a real server-side check — see Backend/routes/
// group.router.ts + expense.router.ts (authorizeRole) and the guards inside
// group.service.ts / expense.service.ts. Change one, change the other.
const PANELS: Record<Role, Panel> = {
  SUPER_ADMIN: {
    summary: "roles.superAdmin.summary",
    sections: [
      {
        heading: "roles.superAdmin.onlyHeading",
        rules: [
          { text: "roles.superAdmin.only.promote", allowed: true },
          { text: "roles.superAdmin.only.adminLeave", allowed: true },
          { text: "roles.superAdmin.only.clone", allowed: true },
          { text: "roles.superAdmin.only.closeDelete", allowed: true },
          { text: "roles.superAdmin.only.credit", allowed: true },
        ],
      },
      {
        heading: "roles.superAdmin.inheritHeading",
        muted: true,
        rules: [
          { text: "roles.superAdmin.inherit.members", allowed: true },
          { text: "roles.superAdmin.inherit.approveJoin", allowed: true },
          { text: "roles.superAdmin.inherit.money", allowed: true },
          { text: "roles.superAdmin.inherit.expenses", allowed: true },
          { text: "roles.superAdmin.inherit.view", allowed: true },
        ],
      },
    ],
    note: { tone: "warn", text: "roles.superAdmin.note" },
  },
  ADMIN: {
    summary: "roles.admin.summary",
    sections: [
      {
        heading: "roles.canDo",
        rules: [
          { text: "roles.admin.can.members", allowed: true },
          { text: "roles.admin.can.approveJoin", allowed: true },
          { text: "roles.admin.can.money", allowed: true },
          { text: "roles.admin.can.expenses", allowed: true },
          { text: "roles.admin.can.memberLeave", allowed: true },
          { text: "roles.admin.can.leave", allowed: true },
        ],
      },
      {
        heading: "roles.cantDo",
        rules: [
          { text: "roles.admin.cant.promote", allowed: false },
          { text: "roles.admin.cant.adminLeave", allowed: false },
          { text: "roles.admin.cant.lifecycle", allowed: false },
          { text: "roles.admin.cant.credit", allowed: false },
        ],
      },
    ],
    note: { tone: "muted", text: "roles.admin.note" },
  },
  MEMBER: {
    summary: "roles.member.summary",
    sections: [
      {
        heading: "roles.canDo",
        rules: [
          { text: "roles.member.can.view", allowed: true },
          { text: "roles.member.can.addExpense", allowed: true },
          { text: "roles.member.can.editOwnExpense", allowed: true },
          { text: "roles.member.can.favourite", allowed: true },
          { text: "roles.member.can.leave", allowed: true },
        ],
      },
      {
        heading: "roles.cantDo",
        rules: [
          { text: "roles.member.cant.members", allowed: false },
          { text: "roles.member.cant.approveJoin", allowed: false },
          { text: "roles.member.cant.money", allowed: false },
          { text: "roles.member.cant.deleteExpense", allowed: false },
          { text: "roles.member.cant.roles", allowed: false },
        ],
      },
    ],
    note: { tone: "muted", text: "roles.member.note" },
  },
};

const AllowedIcon = () => (
  <span className="mt-px shrink-0 w-4 h-4 rounded-[5px] bg-success-400/10 grid place-items-center">
    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-success-700 dark:text-success-300" fill="none" stroke="currentColor"
      strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  </span>
);

const DeniedIcon = () => (
  <span className="mt-px shrink-0 w-4 h-4 rounded-[5px] bg-surface-hover grid place-items-center">
    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-fg-muted" fill="none" stroke="currentColor"
      strokeWidth="3.5" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  </span>
);

const RoleDetails = ({ role = "SUPER_ADMIN", groupName }: RoleDetailsProps) => {
  const { t } = useTranslation();
  const [active, setActive] = useState<Role>(role);
  const baseId = useId();
  const tabRefs = useRef<Partial<Record<Role, HTMLButtonElement | null>>>({});

  const tabId = (r: Role) => `${baseId}-tab-${r}`;
  const panelId = (r: Role) => `${baseId}-panel-${r}`;

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next =
      TAB_ORDER[(TAB_ORDER.indexOf(active) + step + TAB_ORDER.length) % TAB_ORDER.length]!;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      {groupName && (
        <p className="text-theme-2xs font-semibold uppercase tracking-[0.14em] text-fg-muted truncate"
          translate="no">
          {groupName}
        </p>
      )}

      <div
        role="tablist"
        aria-label={t("roles.tablistLabel")}
        onKeyDown={handleTabKeyDown}
        className={`grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-raised border border-line ${
          groupName ? "mt-3" : ""
        }`}
      >
        {TAB_ORDER.map((r) => {
          const isActive = r === active;
          return (
            <button
              key={r}
              ref={(node) => { tabRefs.current[r] = node; }}
              type="button"
              role="tab"
              id={tabId(r)}
              aria-controls={panelId(r)}
              aria-selected={isActive}
              onClick={() => setActive(r)}
              className={`rounded-lg px-2 py-2.5 text-center transition focus:outline-none focus-visible:ring-2 ${
                TAB_RING[r]
              } ${
                isActive
                  ? TAB_ACTIVE[r]
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
            >
              <span className="block text-theme-2xs font-bold uppercase tracking-[0.1em] opacity-55">
                {t(`roles.tier.${roleNs[r]}`)}
              </span>
              <span className="mt-0.5 block text-theme-xs font-semibold">
                {t(`roles.name.${roleNs[r]}`)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Every panel stays mounted so each tab's aria-controls resolves. */}
      {TAB_ORDER.map((r) => {
        const panel = PANELS[r];
        return (
          <div
            key={r}
            role="tabpanel"
            id={panelId(r)}
            aria-labelledby={tabId(r)}
            hidden={r !== active}
            className="mt-4"
          >
            <span
              className={`inline-block text-theme-2xs font-semibold px-2 py-0.5 rounded-md border ${roleGrade[r]}`}
            >
              {t(`roles.name.${roleNs[r]}`)}
            </span>
            <p className="mt-2.5 text-theme-sm leading-relaxed text-fg-muted">{t(panel.summary)}</p>

            {panel.sections.map((section) => (
              <div key={section.heading}>
                <p className="mt-5 mb-2 text-theme-2xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
                  {t(section.heading)}
                </p>
                <ul>
                  {section.rules.map((rule) => (
                    <li
                      key={rule.text}
                      className={`flex items-start gap-2.5 py-2 text-theme-sm leading-snug border-b border-line last:border-0 ${
                        section.muted ? "text-fg-muted" : "text-[#d6d6e0]"
                      }`}
                    >
                      {rule.allowed ? <AllowedIcon /> : <DeniedIcon />}
                      {t(rule.text)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {panel.note?.tone === "warn" && (
              <div className="mt-5 rounded-xl border border-warning-200 dark:border-warning-500/20 bg-warning-400/[0.05] px-3.5 py-3 flex gap-3">
                <svg viewBox="0 0 24 24" className="w-4 h-4 mt-px shrink-0 text-warning-700 dark:text-warning-300" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <p className="text-theme-xs leading-relaxed text-warning-700 dark:text-warning-300">{t(panel.note.text)}</p>
              </div>
            )}

            {panel.note?.tone === "muted" && (
              <div className="mt-5 rounded-xl border border-line bg-surface-raised px-3.5 py-3">
                <p className="text-theme-xs leading-relaxed text-fg-muted">{t(panel.note.text)}</p>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export default RoleDetails;
