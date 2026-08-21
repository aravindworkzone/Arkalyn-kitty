import { useMemo } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Logo, SearchInput } from "../ui";
import RoleBadge from "../ui/RoleBadge";
import SidebarSection from "./SidebarSection";
import SidebarNavItem from "./SidebarNavItem";
import SidebarGroupItem from "./SidebarGroupItem";
import SidebarFilterChips, { type GroupFilter } from "./SidebarFilterChips";
import SidebarGroupFilters from "./SidebarGroupFilters";
import SidebarFooter from "./SidebarFooter";
import { cn } from "../../helpers/cn";
import { groupColor } from "../../helpers/groupColor";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useRecentGroups } from "../../hooks/useRecentGroups";
import { useActiveGroupId } from "../../hooks/useActiveGroupId";
import { useSectionUpdates } from "../../hooks/useSectionUpdates";
import { sectionForPath } from "../../helpers/navSections";
import { useGetUserGroupsQuery } from "../../redux/api/user";
import {
    useGetGroupByIdQuery,
    useGetGroupMembersQuery,
    useToggleFavoriteMutation,
} from "../../redux/api/group";
import { useGetPendingJoinRequestsQuery } from "../../redux/api/invite";
import { useGetCategoriesQuery } from "../../redux/api/category";
import { useGetChitBoardQuery } from "../../redux/api/chit";
import type { Group, GroupSectionKey } from "../../interface/group";
import * as I from "./icons";

/**
 * The app's primary navigation.
 *
 * One component, two variants, chosen by the route: outside a group it is a
 * group navigator; inside one it is that group's menu. The shell — logo, the
 * collapse toggle, and the whole footer — is identical across both so nothing
 * moves under the cursor when you navigate into a group.
 *
 * Cross-component state travels as URL search params (?q=, ?filter=) rather
 * than context or Redux: page/GroupPage.tsx renders the list this filters, the
 * pattern already exists in page/AllExpensesPage.tsx, and it keeps a filtered
 * view linkable and refresh-safe.
 */

export interface SidebarProps {
    /** Icon-only rail. The caller forces this false while the drawer is open. */
    collapsed?: boolean;
    onToggle?: () => void;
    /** Drawer visibility below md. */
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
    const { t } = useTranslation();
    const groupId = useActiveGroupId();
    const { user, isAppOwner } = useCurrentUser();

    const inGroup = !!groupId;

    return (
        <>
            {/* Drawer backdrop. Below md only — at md+ the sidebar is persistent
                and there is nothing to dismiss. */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 z-drawer bg-scrim"
                    style={{ animation: "fadeInBackdrop 0.18s ease-out" }}
                    onClick={onMobileClose}
                    aria-hidden="true"
                />
            )}

            <aside
                aria-label={t("sidebar.label", "Sidebar")}
                className={cn(
                    "fixed inset-y-0 left-0 flex-col bg-surface border-r border-line pt-safe pl-safe",
                    "z-drawer md:z-sidebar",
                    mobileOpen ? "flex w-[280px] max-w-[85vw]" : "hidden md:flex",
                    collapsed ? "md:w-[72px]" : "md:w-[264px]"
                )}
                style={mobileOpen ? { animation: "slideInLeft 0.22s ease-out" } : undefined}
            >
                {/* Brand + collapse toggle.
                    `collapsed` is only ever true at md+ (AppLayout forces it
                    false while the drawer is open), so the two layouts can
                    branch outright instead of fighting over responsive classes.
                    The toggle renders in BOTH — it is the only way back to the
                    expanded sidebar, so hiding it in the rail stranded the user. */}
                {collapsed ? (
                    <div className="flex flex-col items-center gap-1 py-2 shrink-0">
                        <HomeLink collapsed onNavigate={onMobileClose} />
                        {onToggle && <ToggleButton collapsed onToggle={onToggle} />}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 h-14 lg:h-16 px-3 shrink-0">
                        <HomeLink collapsed={false} onNavigate={onMobileClose} />
                        {onToggle && <ToggleButton collapsed={false} onToggle={onToggle} />}
                    </div>
                )}

                {/* Scroll region */}
                <nav className="flex-1 overflow-y-auto no-scrollbar px-2 pb-2 space-y-2">
                    {inGroup ? (
                        <GroupNav
                            groupId={groupId!}
                            collapsed={collapsed}
                            onNavigate={onMobileClose}
                        />
                    ) : (
                        <DashboardNav
                            collapsed={collapsed}
                            isAppOwner={isAppOwner}
                            onNavigate={onMobileClose}
                        />
                    )}
                </nav>

                <SidebarFooter user={user} collapsed={collapsed} onNavigate={onMobileClose} />
            </aside>
        </>
    );
}

/* ── Shared ───────────────────────────────────────────────────────────────── */

function HomeLink({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
    const navigate = useNavigate();
    const { t } = useTranslation();

    // One button that both navigates and dismisses the drawer. Previously this
    // was a <span onClick> nested inside a <button onClick>, so two handlers
    // fired for one press.
    return (
        <button
            type="button"
            onClick={() => {
                navigate("/groups");
                onNavigate?.();
            }}
            aria-label={t("sidebar.home", "Go to your groups")}
            className="flex items-center gap-2 min-w-0 rounded-lg
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
            <Logo variant="mini" className="h-8 w-8 rounded-lg shrink-0" />
            {!collapsed && <Logo variant="word" className="h-9 w-22 shrink-0" />}
        </button>
    );
}

function ToggleButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label={
                collapsed ? t("sidebar.expand", "Expand sidebar") : t("sidebar.collapse", "Collapse sidebar")
            }
            aria-expanded={!collapsed}
            className={cn(
                // Hidden below md: there the sidebar is a drawer, dismissed by
                // the backdrop or the header hamburger, and a rail is not an
                // option worth offering on a phone.
                "hidden md:flex shrink-0 items-center justify-center w-7 h-7 rounded-lg",
                "text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                !collapsed && "ml-auto"
            )}
        >
            <I.Collapse flipped={collapsed} />
        </button>
    );
}

/* ── Dashboard variant ────────────────────────────────────────────────────── */

function DashboardNav({
    collapsed,
    isAppOwner,
    onNavigate,
}: {
    collapsed: boolean;
    isAppOwner: boolean;
    onNavigate?: () => void;
}) {
    const { t } = useTranslation();
    const [params, setParams] = useSearchParams();
    const { data } = useGetUserGroupsQuery();
    const [toggleFavorite] = useToggleFavoriteMutation();
    const { recent } = useRecentGroups();

    // `?? []` would hand back a fresh array identity on every render, which
    // would defeat all four useMemos below.
    const groups: Group[] = useMemo(() => data?.data?.groups ?? [], [data]);
    const search = params.get("q") ?? "";
    const filter = (params.get("filter") as GroupFilter | null) ?? null;

    // Same buckets page/GroupPage.tsx used to render as stat boxes. They
    // deliberately overlap — Manage is a subset of Active — which is why they
    // are filters over one list rather than three separate lists.
    const counts = useMemo(
        () => ({
            active: groups.filter((g) => g.status !== "CLOSED").length,
            closed: groups.filter((g) => g.status === "CLOSED").length,
            manage: groups.filter((g) => g.role !== "MEMBER" && g.status !== "CLOSED").length,
        }),
        [groups]
    );

    const favorites = useMemo(() => groups.filter((g) => g.isFavorite), [groups]);

    const visible = useMemo(() => {
        let list = groups;
        if (filter === "active") list = list.filter((g) => g.status !== "CLOSED");
        else if (filter === "closed") list = list.filter((g) => g.status === "CLOSED");
        else if (filter === "manage") list = list.filter((g) => g.role !== "MEMBER" && g.status !== "CLOSED");

        const q = search.trim().toLowerCase();
        if (q) list = list.filter((g) => g.name?.toLowerCase().includes(q));
        return list;
    }, [groups, filter, search]);

    const recentGroups = useMemo(
        () =>
            recent
                .map((id) => groups.find((g) => g.displayId === id))
                .filter((g): g is Group => !!g),
        [recent, groups]
    );

    // Params are merged, never replaced — search and filter have to coexist.
    const setParam = (key: string, value: string | null) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    };

    const onToggleFavorite = (g: Group) =>
        toggleFavorite({ groupId: g._id, isFavorite: !g.isFavorite });

    return (
        <>
            <div className="flex flex-col gap-0.5">
                {isAppOwner && (
                    <SidebarNavItem
                        to="/admin"
                        icon={<I.Shield />}
                        label={t("sidebar.adminDashboard", "Admin Dashboard")}
                        collapsed={collapsed}
                        onClick={onNavigate}
                    />
                )}
                <SidebarNavItem
                    to="/groups/new"
                    icon={<I.Plus />}
                    label={t("groups.newGroup", "New Group")}
                    collapsed={collapsed}
                    emphasis="primary"
                    onClick={onNavigate}
                />
            </div>

            {recentGroups.length > 0 && (
                <SidebarSection title={t("sidebar.recent", "Recent")} collapsed={collapsed} defaultOpen>
                    {recentGroups.map((g) => (
                        <SidebarGroupItem
                            key={`recent-${g._id}`}
                            group={g}
                            collapsed={collapsed}
                            onToggleFavorite={onToggleFavorite}
                            onNavigate={onNavigate}
                        />
                    ))}
                </SidebarSection>
            )}

            {!collapsed && (
                <div className="px-1.5">
                    <SearchInput
                        value={search}
                        onChange={(v) => setParam("q", v || null)}
                        placeholder={t("groups.searchPlaceholder", "Search groups…")}
                    />
                </div>
            )}

            {favorites.length > 0 && (
                <SidebarSection
                    title={t("sidebar.favorites", "Favorites")}
                    count={favorites.length}
                    collapsed={collapsed}
                    defaultOpen
                >
                    {favorites.map((g) => (
                        <SidebarGroupItem
                            key={`fav-${g._id}`}
                            group={g}
                            collapsed={collapsed}
                            onToggleFavorite={onToggleFavorite}
                            onNavigate={onNavigate}
                        />
                    ))}
                </SidebarSection>
            )}

            <SidebarSection
                title={t("sidebar.allGroups", "All groups")}
                count={groups.length}
                collapsed={collapsed}
                defaultOpen
            >
                {!collapsed && (
                    <SidebarFilterChips
                        value={filter}
                        onChange={(next) => setParam("filter", next)}
                        counts={counts}
                    />
                )}

                {visible.map((g) => (
                    <SidebarGroupItem
                        key={g._id}
                        group={g}
                        collapsed={collapsed}
                        onToggleFavorite={onToggleFavorite}
                        onNavigate={onNavigate}
                    />
                ))}

                {!collapsed && visible.length === 0 && (
                    <p className="px-2.5 py-2 text-theme-xs text-fg-muted">
                        {search
                            ? t("groups.noMatch", { search, defaultValue: "No groups match" })
                            : t("sidebar.noGroups", "No groups yet")}
                    </p>
                )}
            </SidebarSection>
        </>
    );
}

/* ── Group variant ────────────────────────────────────────────────────────── */

function GroupNav({
    groupId,
    collapsed,
    onNavigate,
}: {
    groupId: string;
    collapsed: boolean;
    onNavigate?: () => void;
}) {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const { data: group } = useGetGroupByIdQuery(groupId, { skip: !groupId });
    // Kept after the Members list was removed from the sidebar: this is still
    // where the Group Management badge's pending-leave count comes from.
    const { data: members = [] } = useGetGroupMembersQuery(groupId, { skip: !groupId });
    const { data: categories = [], isLoading: catLoading } = useGetCategoriesQuery(groupId, { skip: !groupId });

    const role = group?.role;
    const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
    const isClosed = group?.status === "CLOSED";

    // Join approvals are admin-only, so skip the fetch entirely for members —
    // the same gate page/GroupDetailPage.tsx applies.
    const { data: joinRequests } = useGetPendingJoinRequestsQuery(groupId, {
        skip: !groupId || !isAdmin,
    });

    const pendingLeaveCount = members.filter((m) => m.leaveRequestedAt).length;
    const pendingRequestCount = pendingLeaveCount + (joinRequests?.length ?? 0);

    // Only a Family group records expenses. A Reserve holds funds for the groups it
    // bankrolls; a Chit holds funds owed to the next member in the rotation. Both
    // drop their expense surfaces rather than show them empty. Credits, Categories
    // (both still need credit buckets), Activity and Connections stay — those are
    // what those groups actually do, and a Chit additionally gets its board below.
    const canRecordExpenses = group?.features?.expenses ?? true;

    // ...but a group may already carry expenses from before its type refused them,
    // and those have to stay reachable — hiding the nav would be the one thing that
    // makes existing records unbrowsable. Expense categories are the tell: neither
    // type seeds any, so any expense category at all means this group has expense
    // history to show. The list is already fetched for canAddExpense below, so this
    // costs no extra request.
    const hasExpenseHistory = categories.length > 0;
    const showExpenseSurfaces = canRecordExpenses || hasExpenseHistory;

    // An expense needs a category. Shown optimistically while the list loads,
    // matching the old bottom-bar behaviour.
    const canAddExpense = canRecordExpenses && !isClosed && (catLoading || categories.length > 0);

    // A chit group runs a rotation and nothing else, so three destinations that
    // make sense for a pooled wallet are dropped rather than left to render
    // something empty or wrong. See each gate below for which and why.
    const isChit = group?.features?.chit ?? false;

    // Only the Collection entry needs this, and only in a chit group — hence the
    // skip. `canViewAll` is the server's own answer about who reads the roster, so
    // the nav and the page agree by construction rather than by both guessing from
    // the role.
    const { data: chitBoard } = useGetChitBoardQuery(
        { groupId: groupId! },
        { skip: !groupId || !isChit }
    );

    // The section the user is looking at right now, marked seen for as long as
    // they stay on it. The sidebar is mounted on every authenticated screen, so
    // reading the route here covers destinations it doesn't itself list — the
    // new-expense form, chit setup — without each page having to report in.
    const { hasUpdate } = useSectionUpdates(groupId, sectionForPath(pathname, groupId));

    // Annotated rather than inferred: seeding `[]` and pushing would leave this an
    // evolving any[], where a typo in a key would go unnoticed. The literal it
    // replaced got its shape from its first element.
    //
    // `section` is which store the row's dot watches — several rows share one
    // (see helpers/navSections.ts), so it is carried per item rather than
    // derived back out of `to`.
    const items: { to: string; icon: ReactNode; label: string; section: GroupSectionKey; end?: boolean }[] = [];

    // Overview is skipped for a chit: /groups/:id redirects to the board, so the
    // entry would only ever bounce. The board is the first item instead.
    if (!isChit) {
        items.push({ to: `/groups/${groupId}`, icon: <I.Home />, label: t("sidebar.overview", "Overview"), section: "overview", end: true });
    }

    // The chit's three pages, listed individually rather than behind one "Chit"
    // entry that then shows its own rail. Two menus of the same destinations drift
    // apart — the same reason GroupActionBar's tiles were removed once the sidebar
    // listed everything they duplicated (see QuickAccessButton's docblock).
    //
    // Shown to EVERY role: the member pages (what do I owe, whose turn is it) are
    // the primary audience, and on the Free plan an isAdmin gate would be no gate
    // at all. Collection is the exception and uses the board's own answer below.
    if (isChit) {
        items.push({ to: `/groups/${groupId}/chit`, icon: <I.User />, label: t("chit.tabMine", "My chit"), section: "chit", end: true });
        items.push({ to: `/groups/${groupId}/chit/cycles`, icon: <I.Cycle />, label: t("chit.tabCycles", "Cycles"), section: "chit" });
        // canViewAll, not isAdmin: the organiser may hold any role, and the server
        // already resolved who sees the roster. Costs one request, and only in a
        // chit group — the query is skipped everywhere else.
        if (chitBoard?.scheme?.canViewAll) {
            items.push({ to: `/groups/${groupId}/chit/collection`, icon: <I.Roster />, label: t("chit.tabCollection", "Collection"), section: "chit" });
        }
    }

    // Credits is skipped for a chit. With hand-recorded contributions refused, every
    // row it could hold is a chit contribution — and the Collection tab and the
    // cycle history already show those broken down by cycle and member, with
    // paid/missed state a flat ledger cannot express.
    if (!isChit) {
        items.push({ to: `/groups/${groupId}/credits`, icon: <I.Wallet />, label: t("sidebar.credits", "Credits"), section: "credits" });
    }

    if (showExpenseSurfaces) {
        items.push({ to: `/groups/${groupId}/expenses`, icon: <I.Receipt />, label: t("sidebar.expenses", "Expenses"), section: "expenses" });
    }

    // Categories is credit-side only in a chit, and both buckets that matter are
    // created without anyone asking — "Other" at group creation, "Chit
    // contributions" on the first recorded payment. There is nothing to manage.
    if (!isChit) {
        items.push({ to: `/groups/${groupId}/categories/new`, icon: <I.Tag />, label: t("sidebar.categories", "Categories"), section: "categories" });
    }

    items.push({ to: `/groups/${groupId}/activity`, icon: <I.Activity />, label: t("sidebar.activity", "Activity"), section: "activity" });

    // The category report is a spend breakdown, so it has nothing to show without
    // expenses — but it does have something to show for past ones.
    if (showExpenseSurfaces) {
        items.push({ to: `/groups/${groupId}/reports/categories`, icon: <I.Chart />, label: t("sidebar.report", "Report"), section: "expenses" });
    }

    // Connections is admin-only, and additionally hidden for a group that can
    // neither fund another nor be funded — for a chit that is the whole page. The
    // API refuses both halves of link formation for it, so the screen would offer
    // a request form that always 403s.
    if (isAdmin && ((group?.features?.receiveFunding ?? true) || (group?.features?.fundOthers ?? false))) {
        items.push({ to: `/groups/${groupId}/connections`, icon: <I.Link />, label: t("sidebar.connections", "Connections"), section: "connections" });
    }

    return (
        <>
            <div className="flex flex-col gap-0.5">
                <SidebarNavItem
                    to="/groups"
                    icon={<I.Back />}
                    label={t("groupDetail.backToGroups", "All groups")}
                    collapsed={collapsed}
                    end
                    onClick={onNavigate}
                />

                {/* Group identity */}
                {!collapsed && group && (
                    <div className="flex items-center gap-2 px-2.5 py-2 min-w-0">
                        <span
                            aria-hidden="true"
                            className="shrink-0 w-2.5 h-2.5 rounded-full"
                            style={{ background: groupColor(group._id) }}
                        />
                        <span className="flex-1 min-w-0 text-theme-sm font-semibold text-fg truncate" translate="no">
                            {group.name}
                        </span>
                        {role && <RoleBadge Role={role} info={false} />}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-0.5">
                {items.map((item) => (
                    <SidebarNavItem
                        key={item.to}
                        to={item.to}
                        icon={item.icon}
                        label={item.label}
                        dot={hasUpdate(item.section)}
                        collapsed={collapsed}
                        end={item.end}
                        onClick={onNavigate}
                    />
                ))}

                {/* Every role, not just admins. This is now the ONLY route into
                    the management screen — the group screen's action bar became
                    a plain "open the sidebar" button — and a plain member needs
                    it to reach the Danger tab and leave the group. The page
                    clamps the tab to what the role may see, so members land on
                    Danger regardless of what the URL asks for. */}
                {role && (
                    <SidebarNavItem
                        // Land on the queue when something is waiting, otherwise
                        // the default tab for the role.
                        to={`/groups/${groupId}/manage?tab=${
                            isAdmin ? (pendingRequestCount > 0 ? "requests" : "addMember") : "danger"
                        }`}
                        icon={<I.Settings />}
                        label={t("sidebar.groupManagement", "Group Management")}
                        badge={isAdmin ? pendingRequestCount : 0}
                        // Membership and invite changes. The badge outranks it
                        // when a queue is actually waiting — SidebarNavItem
                        // drops the dot in that case.
                        dot={hasUpdate("manage")}
                        collapsed={collapsed}
                        onClick={onNavigate}
                    />
                )}

                {/* Hidden, not disabled, when the group's TYPE refuses expenses:
                    that can never be satisfied, and a permanently dead primary
                    action is worse than no action. `disabled` stays for the cases
                    that CAN resolve — a closed group, or one with no categories
                    yet — where the control is telling the user what to fix. */}
                {canRecordExpenses && (
                    <SidebarNavItem
                        to={`/groups/${groupId}/expenses/new`}
                        icon={<I.Plus />}
                        label={t("groupDetail.addExpense", "New Expense")}
                        collapsed={collapsed}
                        emphasis="primary"
                        disabled={!canAddExpense}
                        onClick={onNavigate}
                    />
                )}
            </div>

            <SidebarGroupFilters groupId={groupId} collapsed={collapsed} onNavigate={onNavigate} />
        </>
    );
}
