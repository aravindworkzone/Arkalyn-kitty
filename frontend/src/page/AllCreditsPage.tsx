import { useState } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/header";
import { useGetAllCreditsQuery, useGetGroupByIdQuery } from "../redux/api/group";
import CreditDetailModal from "../components/CreditDetailModal";
import { ExpenseRowSkeleton } from "../components/expense/ExpenseRow";
import { dateLabel, timeLabel } from "../helpers/formatters";
import {
  PageBackground,
  BackButton,
  PageHeader,
  StatCard,
  SearchInput,
} from "../components/ui";
import { useTranslation } from "react-i18next";
import type { GroupCredit } from "../interface/transaction";

const PAGE_STEP = 20;
const MAX_LIMIT = 200;

export default function AllCreditsPage() {
  const { groupId } = useParams();
  const [limit, setLimit] = useState(PAGE_STEP);
  const { data, isLoading, isFetching } = useGetAllCreditsQuery(
    { groupId: groupId!, limit },
    { skip: !groupId }
  );
  const { data: GroupDetails } = useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const [selectedCredit, setSelectedCredit] = useState<GroupCredit | null>(null);
  const [search, setSearch] = useState("");
  const { t } = useTranslation();

  const credits = data?.items ?? [];
  const totalCount = data?.total ?? 0;
  const canLoadMore = credits.length < totalCount && limit < MAX_LIMIT;

  const role = GroupDetails?.role as string | undefined;

  const filtered: GroupCredit[] = credits?.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.description?.toLowerCase().includes(q) ||
      c.performedBy?.name?.toLowerCase().includes(q)
    );
  }) ?? [];

  const groups: { label: string; items: GroupCredit[] }[] = [];
  const seen = new Set<string>();
  filtered.forEach((c) => {
    const label = dateLabel(c.createdAt);
    if (!seen.has(label)) {
      seen.add(label);
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1]!.items.push(c);
  });

  const total = filtered.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />
      <Header />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">
        <BackButton />

        <PageHeader
          accent="success"
          icon={
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          }
          label={t("allCredits.label", "Credits")}
          title={t("allCredits.title", "All Credits")}
          description={t("allCredits.description", "Every contribution credited to this group's wallet.")}
        />

        {!isLoading && (
          <div className="grid grid-cols-2 gap-2">
            <StatCard label={t("allCredits.totalCredited", "Total credited")} value={total} currency />
            <StatCard label={t("allCredits.transactions", "Transactions")} value={search ? filtered.length : totalCount} />
          </div>
        )}

        {!isLoading && (credits?.length ?? 0) > 0 && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("allCredits.searchPlaceholder", "Search by description or member")}
          />
        )}

        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, g) => (
              <div key={g} className="space-y-2">
                <div className="h-3 w-20 bg-line rounded animate-pulse" />
                {[...Array(2)].map((_, i) => (
                  <ExpenseRowSkeleton key={i} />
                ))}
              </div>
            ))}
          </div>
        )}

        {!isLoading && credits?.length === 0 && (
          <div className="text-center py-16">
            <p className="text-fg-muted text-theme-sm">{t("allCredits.noCreditsYet", "No credits yet")}</p>
          </div>
        )}

        {!isLoading && (credits?.length ?? 0) > 0 && filtered.length === 0 && search && (
          <div className="text-center py-12">
            <p className="text-fg-muted text-theme-sm">{t("allCredits.noResults", { search, defaultValue: `No results for "${search}"` })}</p>
            <button
              onClick={() => setSearch("")}
              className="mt-2 text-success-700 dark:text-success-400 text-theme-xs hover:text-success-800 dark:hover:text-success-300 transition-colors"
            >
              {t("allCredits.clearSearch", "Clear search")}
            </button>
          </div>
        )}

        {!isLoading && filtered.length > 0 && groups.map((group, gi) => (
          <div key={group.label} className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <p className="text-theme-xs font-semibold uppercase tracking-widest text-fg-muted" translate="no">
                {group.label}
              </p>
              <p className="text-theme-xs font-mono text-fg-muted" translate="no">
                ₹{group.items.reduce((s, c) => s + c.amount, 0).toLocaleString("en-IN")}
              </p>
            </div>

            {group.items.map((credit, i) => (
              <div
                key={credit._id}
                onClick={() => setSelectedCredit(credit)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedCredit(credit);
                  }
                }}
                aria-label={t("allCredits.openCredit", "Open credit details")}
                className="bg-surface-raised border border-line rounded-xl px-4 py-3.5 shadow-theme-xs
                  flex items-center justify-between cursor-pointer transition-colors
                  hover:bg-surface-hover hover:border-line-strong
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-success-500/40"
                style={{
                  animation: "fadeSlideIn 0.22s ease forwards",
                  animationDelay: `${(gi * 3 + i) * 40}ms`,
                  opacity: 0,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Credits are always the same kind of event, so unlike an
                      expense row this accent is a token, not category data. */}
                  <div className="w-2 h-8 rounded-full shrink-0 bg-success-500/60 shadow-[0_0_8px] shadow-success-500/25" />
                  <div className="min-w-0">
                    <p className="text-theme-sm font-medium text-fg truncate leading-tight" translate="no">
                      {credit.description || t("allCredits.contribution", "Contribution")}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-theme-2xs font-semibold px-1.5 py-0.5 rounded-md
                          bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
                        translate="no"
                      >
                        CREDIT
                      </span>
                      <span className="text-theme-2xs text-fg-muted" translate="no">· {credit.performedBy?.name}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-theme-sm font-semibold font-mono text-success-700 dark:text-success-300 leading-tight" translate="no">
                    +₹{credit.amount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-theme-2xs text-fg-muted mt-0.5" translate="no">{timeLabel(credit.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ))}

        {!isLoading && canLoadMore && (
          <div className="space-y-2">
            <button
              onClick={() => setLimit((l) => Math.min(l + PAGE_STEP, MAX_LIMIT))}
              disabled={isFetching}
              className="w-full py-2.5 rounded-xl border border-line text-fg-muted text-theme-xs font-semibold
                hover:bg-surface-hover hover:text-fg active:bg-surface-hover disabled:opacity-50 transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              {isFetching
                ? t("allCredits.loading", "Loading…")
                : t("allCredits.loadMore", "Load more")}
            </button>
            <p className="text-center text-theme-2xs text-fg-muted">
              {t("allCredits.showingCount", {
                shown: credits.length,
                total: totalCount,
                defaultValue: `Showing ${credits.length} of ${totalCount}`,
              })}
            </p>
          </div>
        )}
      </main>

      <CreditDetailModal
        credit={selectedCredit}
        onClose={() => setSelectedCredit(null)}
        role={role}
        groupId={groupId}
        group={GroupDetails}
      />
    </div>
  );
}
