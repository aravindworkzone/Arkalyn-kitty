import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../../helpers/cn";
import { groupColor } from "../../helpers/groupColor";
import type { Group } from "../../interface/group";

/**
 * A group row in the sidebar's navigator.
 *
 * Hover reveals two actions, Todoist-style: "+" adds an expense straight into
 * that group, "…" opens the options menu. Both are `<button>`s nested visually
 * inside the row but rendered as siblings of the link — a button inside an
 * anchor is invalid HTML and swallows the row's own click target.
 *
 * The "+" is hidden on closed groups (they are frozen — nothing can be added)
 * and the settings entry is admin-only, using the same role test the group
 * detail screen uses: SUPER_ADMIN or ADMIN.
 *
 * Routing note: navigate with `displayId`, mutate with `_id`. The group list
 * carries both and they are not interchangeable.
 */

interface SidebarGroupItemProps {
    group: Group;
    collapsed?: boolean;
    onToggleFavorite: (group: Group) => void;
    onNavigate?: () => void;
}

export default function SidebarGroupItem({
    group,
    collapsed = false,
    onToggleFavorite,
    onNavigate,
}: SidebarGroupItemProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const isClosed = group.status === "CLOSED";
    const isAdmin = group.role === "SUPER_ADMIN" || group.role === "ADMIN";
    const dot = groupColor(group._id);

    useEffect(() => {
        if (!menuOpen) return;
        const onDown = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [menuOpen]);

    const go = (path: string) => {
        setMenuOpen(false);
        navigate(path);
        onNavigate?.();
    };

    const iconBtn =
        "shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-fg-muted " +
        "hover:text-fg hover:bg-surface-hover transition-colors duration-150 " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";

    return (
        <div className="group/row relative flex items-center">
            <NavLink
                to={`/groups/${group.displayId}`}
                onClick={onNavigate}
                title={collapsed ? group.name : undefined}
                aria-label={collapsed ? group.name : undefined}
                className={({ isActive }) =>
                    cn(
                        "group/nav relative flex flex-1 items-center rounded-lg py-1.5 min-w-0",
                        "text-theme-sm transition-colors duration-150",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                        // Same rule as SidebarNavItem: centre the mark in the
                        // rail instead of leaving it padded to the left edge.
                        collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                        isActive
                            ? "text-brand-600 dark:text-brand-400 bg-surface-hover font-medium"
                            : "text-fg-muted hover:text-fg hover:bg-surface-hover"
                    )
                }
            >
                {({ isActive }) => (
                    <>
                        {isActive && (
                            <span
                                aria-hidden="true"
                                className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-brand-500"
                            />
                        )}

                        {/* In the rail the dot is the only thing identifying the
                            group, so it carries the initial and matches the 20px
                            optical size of the nav glyphs above it. Expanded, it
                            stays a plain 10px dot beside the name. */}
                        {collapsed ? (
                            <span
                                className={cn(
                                    "shrink-0 flex items-center justify-center w-5 h-5 rounded-md",
                                    "text-theme-2xs font-bold text-on-accent",
                                    isClosed && "opacity-40"
                                )}
                                style={{ background: dot }}
                                translate="no"
                            >
                                {group.name?.trim().charAt(0).toUpperCase()}
                            </span>
                        ) : (
                            <span
                                aria-hidden="true"
                                className={cn("shrink-0 w-2.5 h-2.5 rounded-full", isClosed && "opacity-40")}
                                style={{ background: dot }}
                            />
                        )}

                        {!collapsed && <span className="flex-1 truncate text-left">{group.name}</span>}

                        {!collapsed && isClosed && (
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0 text-fg-subtle">
                                <path d="M3.5 5V3.5a2.5 2.5 0 015 0V5M2.75 5h6.5v5h-6.5z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}

                        {collapsed && (
                            <span
                                role="tooltip"
                                className="pointer-events-none absolute left-full ml-2 z-dropdown whitespace-nowrap
                                    rounded-md bg-surface-overlay border border-line px-2 py-1
                                    text-theme-xs font-medium text-fg shadow-theme-md
                                    opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150"
                            >
                                {group.name}
                            </span>
                        )}
                    </>
                )}
            </NavLink>

            {!collapsed && (
                <div
                    ref={menuRef}
                    className={cn(
                        "absolute right-1 flex items-center gap-0.5 pl-1",
                        // Kept mounted so focus can reach them by keyboard; only
                        // the paint is hover/focus-gated.
                        "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity duration-150",
                        menuOpen && "opacity-100"
                    )}
                >
                    {!isClosed && (
                        <button
                            type="button"
                            onClick={() => go(`/groups/${group.displayId}/expenses/new`)}
                            aria-label={t("sidebar.addExpenseTo", { group: group.name })}
                            className={cn(iconBtn, "bg-surface")}
                        >
                            <svg width="11" height="11" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                <path d="M5 1.5v7M1.5 5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setMenuOpen((p) => !p)}
                        aria-label={t("sidebar.groupOptions", { group: group.name })}
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                        className={cn(iconBtn, "bg-surface")}
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <circle cx="2.5" cy="6" r="1" />
                            <circle cx="6" cy="6" r="1" />
                            <circle cx="9.5" cy="6" r="1" />
                        </svg>
                    </button>

                    {menuOpen && (
                        <div
                            role="menu"
                            className="absolute top-[calc(100%+4px)] right-0 w-[184px] z-dropdown
                                bg-surface-overlay border border-line rounded-xl overflow-hidden shadow-theme-md p-1.5 space-y-0.5"
                        >
                            <MenuItem
                                onClick={() => {
                                    setMenuOpen(false);
                                    onToggleFavorite(group);
                                }}
                                label={
                                    group.isFavorite
                                        ? t("sidebar.unfavorite", "Remove from favorites")
                                        : t("sidebar.favorite", "Add to favorites")
                                }
                                icon={
                                    <svg width="12" height="12" viewBox="0 0 14 14" fill={group.isFavorite ? "currentColor" : "none"} aria-hidden="true">
                                        <path d="M7 1.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 10l-3.2 1.7.6-3.6L1.8 5.6l3.6-.5L7 1.8z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                                    </svg>
                                }
                            />

                            <MenuItem
                                onClick={() => go(`/groups/${group.displayId}/activity`)}
                                label={t("sidebar.activity", "Activity")}
                                icon={
                                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                        <path d="M1.5 7h3l1.5-3.5L8.5 10.5 10 7h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                }
                            />

                            {isAdmin && !isClosed && (
                                <MenuItem
                                    onClick={() => go(`/groups/${group.displayId}/manage?tab=addMember`)}
                                    label={t("sidebar.groupManagement", "Group Management")}
                                    icon={
                                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
                                            <path d="M7 1.5v1.2M7 11.3v1.2M12.5 7h-1.2M2.7 7H1.5M10.9 3.1l-.85.85M3.95 10.05l-.85.85M10.9 10.9l-.85-.85M3.95 3.95l-.85-.85" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                        </svg>
                                    }
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function MenuItem({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left
                text-theme-xs font-medium text-fg-muted hover:text-fg hover:bg-surface-hover
                active:bg-surface-hover transition-colors duration-100
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
            <span className="shrink-0" aria-hidden="true">{icon}</span>
            <span className="truncate">{label}</span>
        </button>
    );
}
