import { useState, useRef, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";
import NotificationPanel from "./NotificationPanel";
import { Logo, Badge, ThemeToggle } from "./ui";
import MobileNav from "./MobileNav";
import { usePlan } from "../hooks/usePlan";

const Header = () => {
  const { user } = useOutletContext<{ user: any }>();
  const { tier } = usePlan();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const initials = user?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const firstName = user?.name?.split(" ")[0];

  // Shared surface for the two icon buttons flanking the avatar, so the theme
  // and language controls stay visually identical to the notification bell.
  const iconButton =
    "flex items-center justify-center rounded-lg border border-line bg-surface-hover " +
    "text-fg-muted transition-all duration-150 hover:text-fg active:scale-[0.95] " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";

  return (
    <>
      {/* Skip link — only visible on keyboard focus, lets users jump past the
          sticky header straight into the page's <main>. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-skip-link
          focus:px-3 focus:py-2 focus:rounded-lg focus:bg-brand-500 focus:text-white focus:text-theme-sm focus:font-semibold focus:shadow-theme-md"
      >
        {t("nav.skipToContent", "Skip to main content")}
      </a>
      <header className="sticky top-0 z-header flex items-center justify-between px-3 sm:px-5 h-14 lg:h-16
        bg-surface/80 backdrop-blur-xl border-b border-line pt-safe">

        {/* Brand */}
        <div className="flex items-center gap-2 min-w-0" onClick={() => navigate("/groups")} style={{ cursor: "pointer" }}>
          <Logo variant="mini" className="h-8 w-8 rounded-lg lg:h-12 lg:w-12 shrink-0" />
          <Logo variant="word" className="h-10 w-24 rounded-lg lg:h-12 lg:w-26 shrink-0" />
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          <ThemeToggle />

          {/* Language toggle hidden on mobile (lives in profile drawer) */}
          <div className="hidden md:block">
            <LanguageToggle />
          </div>

          <NotificationPanel />

          {/* Avatar dropdown — desktop only. Mobile uses MobileNav profile drawer. */}
          <div ref={dropdownRef} className="relative hidden md:block">
            <button
              onClick={() => setOpen((p) => !p)}
              aria-label={t("nav.profileMenu", "Open profile menu")}
              aria-expanded={open}
              aria-haspopup="menu"
              className={`${iconButton} gap-2 pl-1 pr-2.5 py-1 ${open ? "text-fg" : ""}`}
            >
              <div className="w-[26px] h-[26px] rounded-md bg-gradient-to-br from-brand-500 to-brand-700
                flex items-center justify-center text-theme-xs font-bold text-white shadow-theme-xs">
                <span translate="no">{initials}</span>
              </div>
              <span className="text-theme-xs font-medium max-w-[80px] truncate" translate="no">
                {firstName}
              </span>
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <path d="M3 4l2 2 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            {/* Dropdown */}
            {open && (
              <div className="absolute top-[calc(100%+6px)] right-0 w-[210px]
                bg-surface-overlay border border-line rounded-xl overflow-hidden
                shadow-theme-md z-dropdown
                animate-in fade-in slide-in-from-top-1 duration-150">

                {/* User info */}
                <div className="px-3.5 py-3 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700
                      flex items-center justify-center text-theme-xs font-bold text-white shrink-0">
                      <span translate="no">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-theme-sm font-semibold text-fg truncate leading-tight" translate="no">
                        {user?.name}
                      </p>
                      <p className="text-theme-xs text-fg-muted truncate" translate="no">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="p-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { setOpen(false); navigate("/profile"); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg
                    text-theme-xs font-medium text-fg-muted hover:text-fg hover:bg-surface-hover
                    active:text-fg active:bg-surface-hover transition-all duration-100 group">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"
                      className="text-fg-subtle group-hover:text-fg-muted transition-colors">
                      <circle cx="6.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M1.5 11.5c0-2.761 2.239-4 5-4s5 1.239 5 4"
                        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    {t("nav.profile")}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setOpen(false); navigate("/pricing"); }}
                    className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg
                      text-theme-xs font-medium text-fg-muted hover:text-fg hover:bg-surface-hover
                      active:text-fg active:bg-surface-hover transition-all duration-100 group"
                  >
                    <span className="flex items-center gap-2.5">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"
                        className="text-fg-subtle group-hover:text-fg-muted transition-colors">
                        <path d="M1.5 4.5h10M3 1.5h7a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0110 11.5H3A1.5 1.5 0 011.5 10V3A1.5 1.5 0 013 1.5z"
                          stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {t("nav.plans", "Plans & Billing")}
                    </span>
                    <Badge tone={tier === "FREE" ? "gray" : "brand"} translate="no">{tier}</Badge>
                  </button>

                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Anchor that the skip link targets — keyboard focus lands here, then
          Tab moves into the actual page content. */}
      <span id="main-content" tabIndex={-1} className="sr-only" aria-hidden="true">{t("nav.mainContent", "Main content")}</span>

      <MobileNav />
    </>
  );
};

export default Header;
