import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGetCategoriesQuery } from "../redux/api/category";

/**
 * Fixed bottom navigation for small screens. Hidden on >=md (where the header
 * dropdown handles the same actions). The Profile tab routes straight to the
 * full profile page — language, plan, password and sign-out all live there
 * now, so there's no separate mobile drawer.
 */
export default function MobileNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { groupId } = useParams<{ groupId: string }>();

  const onGroupsList = location.pathname === "/groups";
  const inGroup = !!groupId;
  const path = location.pathname;

  // An expense needs a category — keep the "+ Expense" action disabled until
  // the group has one. Shown optimistically while the list is still loading.
  const { data: categories = [], isLoading: catLoading } = useGetCategoriesQuery(groupId!, {
    skip: !inGroup,
  });
  const canAddExpense = catLoading || categories.length > 0;

  // Contextual middle action: "+ Expense" inside a group, "+ Group" on the list,
  // disabled elsewhere so the nav stays predictable.
  const addAction = inGroup
    ? canAddExpense
      ? { label: t("groupDetail.addExpense", "Add Expense"), to: `/groups/${groupId}/expenses/new` }
      : null
    : onGroupsList
      ? { label: t("groups.newGroup", "New Group"), to: "/groups/new" }
      : null;

  const isActive = (testPath: string) => path === testPath;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-bottom-nav pb-safe
        bg-surface/90 backdrop-blur-xl border-t border-line"
      aria-label="Primary navigation"
    >
      <div className="grid grid-cols-3 h-14">
        <NavItem
          label={t("nav.groups", "Groups")}
          active={isActive("/groups") || path.startsWith("/groups/")}
          onClick={() => navigate("/groups")}
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 8l7-5 7 5v8a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1V8z"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />

        <NavItem
          label={addAction?.label ?? t("nav.add", "Add")}
          active={false}
          disabled={!addAction}
          onClick={() => addAction && navigate(addAction.to)}
          highlight
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10 6.5v7M6.5 10h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />

        <NavItem
          label={t("nav.profile", "Profile")}
          active={isActive("/profile")}
          onClick={() => navigate("/profile")}
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3.5 17c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          }
        />
      </div>
    </nav>
  );
}

interface NavItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  highlight?: boolean;
  disabled?: boolean;
}

function NavItem({ label, active, onClick, icon, highlight, disabled }: NavItemProps) {
  // The middle "add" action is the primary one, so it carries brand colour at
  // rest; the side tabs only take it once active.
  const color = disabled
    ? "text-fg-subtle opacity-50"
    : active
      ? "text-brand-500 dark:text-brand-400"
      : highlight ? "text-brand-500/80 dark:text-brand-400/80" : "text-fg-muted";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-0.5 min-h-touch transition-colors
        ${color} ${disabled ? "" : "active:bg-surface-hover"}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="text-theme-xs font-semibold leading-none truncate max-w-[80px] px-1">{label}</span>
    </button>
  );
}
