import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGetCategoriesQuery } from "../redux/api/category";

/**
 * Fixed bottom navigation for small screens. Hidden on >=md (where the header
 * dropdown handles the same actions). The Profile tab routes straight to the
 * full profile page — language, plan, tour, password and sign-out all live
 * there now, so there's no separate mobile drawer.
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
      className="md:hidden fixed bottom-0 inset-x-0 z-40 pb-safe
        bg-[#080c14]/90 backdrop-blur-xl border-t border-white/[0.08]"
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
          // The desktop "Create Group" button is hidden on mobile, so the
          // tour spotlight latches onto this FAB. For "create-expense" the
          // in-page action grid in GroupDetailPage stays visible on mobile —
          // we leave that one untagged so the spotlight uses the in-page
          // button (which lives in normal flow and isn't covered by the
          // bottom-nav's backdrop-blur stacking context).
          dataTour={onGroupsList ? "create-group" : undefined}
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
  dataTour?: string;
}

function NavItem({ label, active, onClick, icon, highlight, disabled, dataTour }: NavItemProps) {
  const color = disabled
    ? "text-white/15"
    : active
      ? highlight ? "text-violet-300" : "text-cyan-300"
      : highlight ? "text-violet-400/80" : "text-white/45";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-tour={dataTour}
      className={`flex flex-col items-center justify-center gap-0.5 min-h-touch transition-colors
        ${color} ${disabled ? "" : "active:bg-white/[0.04]"}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="text-[10px] font-semibold leading-none truncate max-w-[80px] px-1">{label}</span>
    </button>
  );
}
