import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGetUserGroupsQuery } from "../redux/api/user";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useToggleFavoriteMutation } from "../redux/api/group";
import Header from "../components/header";
import EmptyState from "../components/EmptyList";
import GroupCard from "../components/GroupCard";
import { ActionButton, PageBackground, SearchInput } from "../components/ui";
import { useTranslation } from "react-i18next";
import type { RootState } from "../redux/store";
import { useDispatch, useSelector } from "react-redux";
import { leaveGroup } from "../socket/emiter/group.emit";
import { clearGroupId } from "../redux/slice/group.slice";

const GroupPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useGetUserGroupsQuery();
  const { isAppOwner: isOwner } = useCurrentUser();
  const groups = data?.data?.groups || [];
  const [search, setSearch] = useState("");
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const groupId = useSelector((state: RootState) => state.group);
  const [toggleFavorite, { isLoading: isTogglingFavorite, originalArgs }] = useToggleFavoriteMutation();

  const filtered = groups.filter((g: any) =>
    g.name?.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
      if (!groupId) return;
      leaveGroup(groupId);
      dispatch(clearGroupId());
  }, []);

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />

      <Header />

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
          <div className="flex items-center gap-2">
          {isOwner && (
            <ActionButton
              tone="warning"
              fullWidth={false}
              onClick={() => navigate("/admin")}
              className="inline-flex items-center gap-2 px-4"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 4.5h10M3.5 1.5h7a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 11V3a1.5 1.5 0 011.5-1.5z"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Admin Dashboard
            </ActionButton>
          )}
          <ActionButton
            tone="brand"
            fullWidth={false}
            onClick={() => navigate("/groups/new")}
            className="hidden sm:inline-flex group items-center gap-2 px-4"
          >
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-brand-500/30 group-hover:bg-brand-500/50 transition-colors">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                <path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            {t("groups.newGroup")}
          </ActionButton>
          </div>
        </div>

        {!isLoading && groups.length > 0 && (() => {
          // Closed groups are frozen — they're surfaced separately and never
          // counted as something you actively manage.
          const closedCount = groups.filter((g: any) => g.status === "CLOSED").length;
          const activeCount = groups.length - closedCount;
          const manageCount = groups.filter(
            (g: any) => g.role !== "MEMBER" && g.status !== "CLOSED"
          ).length;

          // Only render a box when its category actually has groups.
          const stats = [
            { key: "active", label: t("groups.activeGroups", "Active Groups"), value: activeCount },
            { key: "closed", label: t("groups.closedGroups", "Closed Groups"), value: closedCount },
            { key: "manage", label: t("groups.youManage"), value: manageCount },
          ].filter((s) => s.value > 0);

          if (stats.length === 0) return null;

          const gridCols =
            stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3";

          return (
            <div className={`grid ${gridCols} gap-3 mb-5`}>
              {stats.map((stat) => (
                <div
                  key={stat.key}
                  className="rounded-xl bg-surface-raised border border-line px-4 py-3 shadow-theme-xs"
                >
                  <p className="text-theme-2xs uppercase tracking-widest text-fg-muted mb-1">
                    {stat.label}
                  </p>
                  <p className="text-theme-xl font-semibold text-fg" translate="no">{stat.value}</p>
                </div>
              ))}
            </div>
          );
        })()}

        {!isLoading && groups.length > 0 && (
          <div className="mb-5">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("groups.searchPlaceholder")}
            />
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
        ) : filtered.length === 0 && search ? (
          <div className="text-center py-16">
            <p className="text-fg-muted text-theme-sm">{t("groups.noMatch", { search })}</p>
            <button
              onClick={() => setSearch("")}
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
