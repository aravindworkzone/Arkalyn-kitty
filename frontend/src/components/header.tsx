import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import NotificationBell from "./NotificationBell";
import { Logo } from "./ui";
import { Menu } from "./sidebar/icons";

/**
 * Mobile-only top bar: menu, brand, notifications.
 *
 * At md+ the sidebar owns every control that used to live here — theme,
 * language, profile, notifications — so this is what remains below it. The
 * `md:hidden` must stay the exact complement of the sidebar's `hidden md:flex`,
 * or both render at md.
 *
 * This is the ONLY notification bell below md. SidebarFooter's copy is gated to
 * md+ precisely so the drawer doesn't put a second one on screen. The bell is a
 * link to /notifications now, not a dropdown trigger.
 *
 * Navigation below md is the drawer, opened from the hamburger here — there is
 * no bottom tab bar. It was removed once the sidebar covered the same ground:
 * two navigation surfaces disagreeing about where you are is worse than one.
 *
 * It no longer reads the outlet context; the profile menu moved to
 * SidebarFooter, which takes the user as a prop from AppLayout.
 */

interface HeaderProps {
  /** Opens the off-canvas sidebar. Omitted when rendered outside AppLayout. */
  onOpenSidebar?: () => void;
}

const Header = ({ onOpenSidebar }: HeaderProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <>
      {/* Skip link — only visible on keyboard focus, lets users jump past the
          sticky header straight into the page's <main>. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-skip-link
          focus:px-3 focus:py-2 focus:rounded-lg focus:bg-brand-500 focus:text-on-accent focus:text-theme-sm focus:font-semibold focus:shadow-theme-md"
      >
        {t("nav.skipToContent", "Skip to main content")}
      </a>

      <header
        className="md:hidden sticky top-0 z-header flex items-center gap-2 px-2 h-14
          bg-surface/80 backdrop-blur-xl border-b border-line pt-safe"
      >
        {onOpenSidebar && (
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label={t("sidebar.open", "Open navigation")}
            aria-haspopup="dialog"
            className="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg
              text-fg-muted hover:text-fg hover:bg-surface-hover active:scale-[0.95]
              transition-all duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <Menu />
          </button>
        )}

        {/* Brand. The mini mark is dropped here — the hamburger already owns the
            leading slot, and doubling it with the wordmark crowded 375px. */}
        <button
          type="button"
          onClick={() => navigate("/groups")}
          aria-label={t("sidebar.home", "Go to your groups")}
          className="flex items-center min-w-0 rounded-lg
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <Logo variant="word" className="h-9 w-24 shrink-0" />
        </button>

        <div className="ml-auto flex items-center shrink-0 pr-1">
          <NotificationBell />
        </div>
      </header>

      {/* Anchor that the skip link targets — keyboard focus lands here, then
          Tab moves into the actual page content. */}
      <span id="main-content" tabIndex={-1} className="sr-only" aria-hidden="true">
        {t("nav.mainContent", "Main content")}
      </span>
    </>
  );
};

export default Header;
