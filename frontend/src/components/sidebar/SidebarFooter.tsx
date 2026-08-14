import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { Badge, ThemeToggle } from "../ui";
import LanguageToggle from "../LanguageToggle";
import NotificationBell from "../NotificationBell";
import { cn } from "../../helpers/cn";
import { usePlan } from "../../hooks/usePlan";
import { useSignOutMutation } from "../../redux/api/auth";
import { api } from "../../redux/api/base";
import { socket } from "../../socket/socket";
import type { CurrentUser } from "../../interface/user";

/**
 * The sidebar's bottom block: utility row, notifications, profile.
 *
 * These four controls used to live in components/header.tsx. The header is now
 * mobile-only, so this is their home at lg+ — moving them rather than copying
 * them, so there is exactly one theme toggle and one notification bell mounted
 * at any breakpoint.
 *
 * The profile menu opens UPWARD (`bottom-full`): it sits at the bottom of a
 * full-height column, so a downward panel would render off-screen.
 */

interface SidebarFooterProps {
    user: CurrentUser | null;
    collapsed?: boolean;
    onNavigate?: () => void;
}

export default function SidebarFooter({ user, collapsed = false, onNavigate }: SidebarFooterProps) {
    const { t } = useTranslation();
    const { tier } = usePlan();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [signOut, { isLoading: signingOut }] = useSignOutMutation();
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const initials = user?.name
        ?.split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const go = (path: string) => {
        setOpen(false);
        navigate(path);
        onNavigate?.();
    };

    // Mirrors page/ProfilePage.tsx's handleSignOut: clear the RTK cache and drop
    // the socket even if the network call fails, so a failed logout can never
    // leave a half-authenticated shell behind.
    const handleSignOut = async () => {
        try {
            await signOut().unwrap();
        } catch {
            /* still tear down locally */
        }
        setOpen(false);
        dispatch(api.util.resetApiState());
        socket.disconnect();
        navigate("/login", { replace: true });
    };

    return (
        <div className={cn("border-t border-line px-2 py-2 space-y-1", collapsed && "px-1.5")}>
            {/* Utility row — theme, language, notifications. Stacked in the
                rail, where all three are 32px squares and line up. */}
            <div className={cn("flex items-center gap-1.5", collapsed ? "flex-col" : "px-0.5")}>
                <ThemeToggle />
                <LanguageToggle compact={collapsed} />

                {/* md+ only. Below md the sidebar is a drawer and the header is
                    on screen, so mounting the bell here too put two of them in
                    the viewport at once whenever the drawer was open. The header
                    keeps it there — notifications should not require opening a
                    drawer to reach. */}
                <div className="hidden md:block">
                    <NotificationBell />
                </div>
            </div>

            {/* Profile */}
            <div ref={menuRef} className="relative">
                <button
                    type="button"
                    onClick={() => setOpen((p) => !p)}
                    aria-label={t("nav.profileMenu", "Open profile menu")}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    title={collapsed ? (user?.name ?? undefined) : undefined}
                    className={cn(
                        "w-full flex items-center gap-2.5 rounded-lg px-2 py-2 min-w-0",
                        "text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors duration-150",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                        open && "text-fg bg-surface-hover",
                        collapsed && "justify-center px-0"
                    )}
                >
                    <span
                        className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700
                            flex items-center justify-center text-theme-xs font-bold text-on-accent shadow-theme-xs"
                    >
                        <span translate="no">{initials}</span>
                    </span>

                    {!collapsed && (
                        <>
                            <span className="flex-1 min-w-0 text-left">
                                <span className="block text-theme-sm font-medium text-fg truncate leading-tight" translate="no">
                                    {user?.name}
                                </span>
                                <span className="block text-theme-2xs text-fg-muted truncate" translate="no">
                                    {user?.email}
                                </span>
                            </span>
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 10 10"
                                fill="none"
                                aria-hidden="true"
                                className={cn("shrink-0 transition-transform duration-200", open ? "rotate-180" : "")}
                            >
                                <path d="M3 4l2 2 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            </svg>
                        </>
                    )}
                </button>

                {open && (
                    <div
                        role="menu"
                        className={cn(
                            "absolute bottom-full mb-2 z-dropdown w-[210px]",
                            "bg-surface-overlay border border-line rounded-xl overflow-hidden shadow-theme-md",
                            collapsed ? "left-0" : "left-0 right-0 w-auto"
                        )}
                    >
                        <div className="p-1.5 space-y-0.5">
                            <MenuItem
                                onClick={() => go("/profile")}
                                label={t("nav.profile", "Profile")}
                                icon={
                                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                                        <circle cx="6.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                                        <path d="M1.5 11.5c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                    </svg>
                                }
                            />

                            <MenuItem
                                onClick={() => go("/pricing")}
                                label={t("nav.plans", "Plans & Billing")}
                                trailing={<Badge tone={tier === "FREE" ? "gray" : "brand"} translate="no">{tier}</Badge>}
                                icon={
                                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                                        <path d="M1.5 4.5h10M3 1.5h7a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0110 11.5H3A1.5 1.5 0 011.5 10V3A1.5 1.5 0 013 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                }
                            />
                        </div>

                        <div className="p-1.5 border-t border-line">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleSignOut}
                                disabled={signingOut}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left
                                    text-theme-xs font-medium text-error-600 dark:text-error-400
                                    hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors duration-100
                                    disabled:opacity-60 disabled:pointer-events-none
                                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                            >
                                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                                    <path d="M5 11.5H2.5A1 1 0 011.5 10.5v-8a1 1 0 011-1H5M8.5 9l3-2.5-3-2.5M11.5 6.5h-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {signingOut
                                    ? t("profile.signingOut", "Signing out…")
                                    : t("nav.signOut", "Sign out")}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function MenuItem({
    onClick,
    label,
    icon,
    trailing,
}: {
    onClick: () => void;
    label: string;
    icon: React.ReactNode;
    trailing?: React.ReactNode;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg
                text-theme-xs font-medium text-fg-muted hover:text-fg hover:bg-surface-hover
                active:bg-surface-hover transition-colors duration-100
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
            <span className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0" aria-hidden="true">{icon}</span>
                <span className="truncate">{label}</span>
            </span>
            {trailing}
        </button>
    );
}
