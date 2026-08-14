import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGetUserGroupsQuery } from "../redux/api/user";
import { useToggleFavoriteMutation } from "../redux/api/group";
import EmptyState from "../components/EmptyList";
import GroupCard from "../components/GroupCard";
import { PageBackground } from "../components/ui";
import { useTranslation } from "react-i18next";
import type { RootState } from "../redux/store";
import { useDispatch, useSelector } from "react-redux";
import { leaveGroup } from "../socket/emiter/group.emit";
import { clearGroupId } from "../redux/slice/group.slice";

const GroupPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useGetUserGroupsQuery();
  const groups = data?.data?.groups || [];
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const groupId = useSelector((state: RootState) => state.group);
  const [toggleFavorite, { isLoading: isTogglingFavorite, originalArgs }] = useToggleFavoriteMutation();

  // Search and the Active/Closed/Manage filter are driven by the sidebar, which
  // writes them as URL params. Reading them here rather than holding local state
  // is what lets one control filter a list it does not render — and it keeps a
  // filtered view linkable and refresh-safe.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const filter = searchParams.get("filter");

  const filtered = groups.filter((g) => {
    if (filter === "active" && g.status === "CLOSED") return false;
    if (filter === "closed" && g.status !== "CLOSED") return false;
    if (filter === "manage" && (g.role === "MEMBER" || g.status === "CLOSED")) return false;
    return g.name?.toLowerCase().includes(search.toLowerCase());
  });

  const clearFilters = () => setSearchParams({}, { replace: true });

  useEffect(() => {
      if (!groupId) return;
      leaveGroup(groupId);
      dispatch(clearGroupId());
  }, []);

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />


      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-theme-xs font-medium tracking-widest uppercase text-brand-600 dark:text-brand-400 mb-1">
              {t("groups.dashboard")}
            </p>
            <h1 className="text-title-sm font-semibold text-fg tracking-tight">
              {t("groups.yourGroups")}
            </h1>
          </div>
        </div>

        {/* The counts, the search box, "New Group" and "Admin Dashboard" all
            live in the sidebar now. What remains here is the active filter
            readout, so a narrowed list always says why and offers a way out. */}
        {(search || filter) && (
          <div className="flex items-center justify-between gap-3 mb-5 rounded-xl
            bg-surface-raised border border-line px-4 py-2.5 shadow-theme-xs">
            <p className="text-theme-xs text-fg-muted truncate">
              {filter
                ? t(`groups.${filter === "manage" ? "youManage" : filter === "closed" ? "closedGroups" : "activeGroups"}`)
                : t("allExpenses.filterActive", "Filtered")}
              {search && <span className="text-fg"> · “{search}”</span>}
              <span className="text-fg-subtle" translate="no"> · {filtered.length}</span>
            </p>
            <button
              onClick={clearFilters}
              className="shrink-0 text-theme-xs font-medium text-brand-600 dark:text-brand-400
                hover:text-brand-700 dark:hover:text-brand-300 transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md"
            >
              {t("allExpenses.clearFilter", "Clear filter")}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-[88px] rounded-2xl bg-surface-raised border border-line animate-pulse"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        ) : filtered.length === 0 && (search || filter) ? (
          <div className="text-center py-16">
            <p className="text-fg-muted text-theme-sm">
              {search
                ? t("groups.noMatch", { search })
                : t("groups.noFilterMatch", "No groups match this filter")}
            </p>
            <button
              onClick={clearFilters}
              className="mt-2 text-brand-600 dark:text-brand-400 text-theme-xs hover:text-brand-700 dark:hover:text-brand-300 active:text-brand-700 transition-colors"
            >
              {t("groups.clearSearch")}
            </button>
          </div>
        ) : groups.length === 0 ? (
          <EmptyState onClick={() => navigate("/groups/new")} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((group: any, i: number) => (
              <div
                key={group._id}
                style={{
                  animation: `fadeSlideIn 0.3s ease forwards`,
                  animationDelay: `${i * 50}ms`,
                  opacity: 0,
                }}
              >
                <GroupCard
                  key={group._id}
                  group={group}
                  onClick={() => navigate(`/groups/${group.displayId}`)}
                  onAddExpense={() => navigate(`/groups/${group.displayId}/expenses/new`)}
                  onToggleFavorite={() => {
                    toggleFavorite({ groupId: group._id, isFavorite: !group.isFavorite });
                  }}
                  isTogglingFavorite={isTogglingFavorite && originalArgs?.groupId === group._id}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default GroupPage;
