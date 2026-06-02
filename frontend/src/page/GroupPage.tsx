import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGetUserGroupsQuery } from "../redux/api/user";
import { useGetUserQuery } from "../redux/api/auth";
import { useToggleFavoriteMutation } from "../redux/api/group";
import Header from "../components/header";
import EmptyState from "../components/EmptyList";
import GroupCard from "../components/GroupCard";
import { useTranslation } from "react-i18next";
import type { RootState } from "../redux/store";
import { useDispatch, useSelector } from "react-redux";
import { leaveGroup } from "../socket/emiter/group.emit";
import { clearGroupId } from "../redux/slice/group.slice";

const GroupPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useGetUserGroupsQuery();
  const { data: me } = useGetUserQuery();
  const isOwner = me?.data?.user?.role === "APP_OWNER";
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
    <div className="min-h-screen bg-[#080c14] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute top-1/3 -right-60 w-[600px] h-[600px] rounded-full bg-violet-600/5 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/4 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <Header />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-medium tracking-widest uppercase text-cyan-400/70 mb-1">
              {t("groups.dashboard")}
            </p>
            <h1 className="text-2xl font-semibold text-[#f0eeff] tracking-tight">
              {t("groups.yourGroups")}
            </h1>
          </div>
          <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => navigate("/admin")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px]
                font-semibold text-amber-200 bg-amber-500/10 border border-amber-500/25
                hover:bg-amber-500/20 hover:border-amber-400/40
                active:bg-amber-500/20 active:border-amber-400/40
                transition-all duration-200 shadow-lg shadow-amber-900/10"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M2 4.5h10M3.5 1.5h7a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 11V3a1.5 1.5 0 011.5-1.5z"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Admin Dashboard
            </button>
          )}
          <button
            onClick={() => navigate("/groups/new")}
            data-tour="create-group"
            className="hidden sm:inline-flex group items-center gap-2 px-4 py-2.5 rounded-xl text-[13px]
              font-semibold text-violet-200 bg-violet-500/10 border border-violet-500/20
              hover:bg-violet-500/20 hover:border-violet-400/40
              active:bg-violet-500/20 active:border-violet-400/40
              transition-all duration-200
              shadow-lg shadow-violet-900/10"
          >
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-violet-500/30 group-hover:bg-violet-500/50 transition-colors">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M4 1v6M1 4h6" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            {t("groups.newGroup")}
          </button>
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
                  className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-4 py-3"
                >
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                    {stat.label}
                  </p>
                  <p className="text-xl font-semibold text-[#e8e3ff]" translate="no">{stat.value}</p>
                </div>
              ))}
            </div>
          );
        })()}

        {!isLoading && groups.length > 0 && (
          <div className="relative mb-5">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder={t("groups.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
                text-base sm:text-[13px] text-slate-300 placeholder:text-slate-600
                focus:outline-none focus:border-violet-500/40 focus:bg-white/[0.06]
                transition-all duration-200"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 active:text-slate-400 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-[88px] rounded-2xl bg-white/[0.03] border border-white/[0.05] animate-pulse"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        ) : filtered.length === 0 && search ? (
          <div className="text-center py-16">
            <p className="text-slate-500 text-sm">{t("groups.noMatch", { search })}</p>
            <button onClick={() => setSearch("")} className="mt-2 text-violet-400 text-xs hover:text-violet-300 active:text-violet-300 transition-colors">
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
                data-tour={i === 0 ? "open-group" : undefined}
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

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default GroupPage;
