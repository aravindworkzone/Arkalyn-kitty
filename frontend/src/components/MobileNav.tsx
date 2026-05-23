import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSignOutMutation } from "../redux/api/auth";
import { useGetCategoriesQuery } from "../redux/api/category";
import { socket } from "../socket/socket";
import { BottomSheet } from "./ui";
import LanguageToggle from "./LanguageToggle";
import { useTour } from "../tour/useTour";

interface User {
  name?: string;
  email?: string;
}

interface Props {
  user?: User;
}

/**
 * Fixed bottom navigation for small screens. Hidden on >=md (where the
 * header dropdown handles the same actions).
 */
export default function MobileNav({ user }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { groupId } = useParams<{ groupId: string }>();
  const [signOut] = useSignOutMutation();
  const [profileOpen, setProfileOpen] = useState(false);
  const { start: startTour, reset: resetTour } = useTour();

  const handleTakeTour = () => {
    setProfileOpen(false);
    resetTour();
    startTour();
    navigate("/groups");
  };

  const onGroupsList = location.pathname === "/groups";
  const inGroup = !!groupId;
  const path = location.pathname;

  // An expense needs a category — keep the "+ Expense" action disabled until
  // the group has one. Shown optimistically while the list is still loading.
  const { data: categories = [], isLoading: catLoading } = useGetCategoriesQuery(groupId, {
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

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    setProfileOpen(false);
    socket.disconnect();
    navigate("/login", { replace: true });
  };

  const isActive = (testPath: string) => path === testPath;

  return (
    <>
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
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10 6.5v7M6.5 10h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          />

          <NavItem
            label={t("nav.profile", "Profile")}
            active={profileOpen}
            onClick={() => setProfileOpen(true)}
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

      <BottomSheet
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        title={t("nav.profile", "Profile")}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700
              flex items-center justify-center text-sm font-bold text-white/90 shrink-0">
              <span translate="no">{initials || "?"}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#f0eeff] truncate" translate="no">
                {user?.name ?? "—"}
              </p>
              <p className="text-xs text-white/35 truncate" translate="no">{user?.email ?? ""}</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <p className="text-sm text-white/70">{t("nav.language", "Language")}</p>
            <LanguageToggle />
          </div>

          <button
            type="button"
            onClick={handleTakeTour}
            className="w-full min-h-touch flex items-center justify-center gap-2 rounded-xl
              bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-sm font-semibold
              hover:bg-cyan-500/15 active:bg-cyan-500/20 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.8" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 5.2c.2-1 1-1.6 2-1.6 1.1 0 2 .8 2 1.9 0 1-.7 1.5-1.5 1.9-.5.3-.7.6-.7 1.1M7 10v.1"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            {t("nav.takeTour", "Take a Tour")}
          </button>

          <button
            type="button"
            className="w-full min-h-touch flex items-center justify-center gap-2 rounded-xl
              bg-red-500/10 border border-red-500/20 text-red-300 text-sm font-semibold
              hover:bg-red-500/15 active:bg-red-500/20 transition-colors"
            onClick={handleSignOut}
          >
            <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
              <path d="M5 2H2.5A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12H5M9 9.5l2.5-3L9 3M4.5 6.5h7"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("nav.signOut")}
          </button>
        </div>
      </BottomSheet>
    </>
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
      className={`flex flex-col items-center justify-center gap-0.5 min-h-touch transition-colors
        ${color} ${disabled ? "" : "active:bg-white/[0.04]"}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="text-[10px] font-semibold leading-none truncate max-w-[80px] px-1">{label}</span>
    </button>
  );
}
