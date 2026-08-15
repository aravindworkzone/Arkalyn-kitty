import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useGetAllExpensesInfiniteQuery } from "../redux/api/expense";
import { useGetGroupByIdQuery } from "../redux/api/group";
import { useGetGroupLinksQuery } from "../redux/api/groupLink";
import ExpenseDetailModal from "../components/ExpenseDetailModal";
import ExpenseRow, { ExpenseRowSkeleton } from "../components/expense/ExpenseRow";
import { dateLabel } from "../helpers/formatters";
import {
  PageBackground,
  PageContainer,
  BackButton,
  PageHeader,
  StatCard,
  SearchInput,
  Chip,
} from "../components/ui";

import { useTranslation } from "react-i18next";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

/**
 * Wide layout: the ledger keeps the main column, the meta (totals, active
 * filter) moves into a rail that stays put while the list scrolls.
 *
 * A single 1152px-wide column of expense rows puts the title at the far left
 * and the amount at the far right with a void between them, which is harder to
 * read than the old 672px version was — width has to be spent on a second
 * column, not on stretching one.
 */
const SPLIT = "grid items-start gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_300px]";

export default function AllExpensesPage() {
  const { groupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters arrive as URL params when the user drills in from a report card.
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const paidBy = searchParams.get("paidBy") ?? undefined;
  const spender = searchParams.get("spender") ?? undefined;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;
  // A connected group's id, or the literal "own" for this group's own wallet.
  const fundedBy = searchParams.get("fundedBy") ?? undefined;
  const filterLabel = searchParams.get("label") ?? undefined;
  const hasFilter = Boolean(categoryId || paidBy || spender || fundedBy || startDate || endDate);

  // A changed filter changes the query arg, so RTK Query starts a fresh
  // page set automatically — no manual reset needed.
  const { data, isLoading, isFetching, hasNextPage, fetchNextPage } =
    useGetAllExpensesInfiniteQuery(
      { groupId: groupId!, categoryId, paidBy, spender, fundedBy, startDate, endDate },
      { skip: !groupId }
    );
  // Only groups that actually fund this one can appear in the picker, so the
  // control stays hidden entirely for the majority of groups that have none.
  const { data: groupLinks } = useGetGroupLinksQuery(groupId!, { skip: !groupId });
  const funders = (groupLinks?.incoming ?? [])
    .filter((l) => l.status === "ACTIVE")
    .map((l) => {
      const src = l.sourceGroupId;
      return typeof src === "string"
        ? { id: src, name: src }
        : { id: src._id, name: src.name };
    });

  /**
   * Params are merged, never replaced — funded-by has to compose with a
   * category or date filter the user arrived with, and clearing it must not
   * silently drop the rest. The stale `label` is dropped because it described
   * whichever filter set the URL originally.
   */
  const setFundedBy = (value?: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete("label");
    if (value) next.set("fundedBy", value);
    else next.delete("fundedBy");
    setSearchParams(next, { replace: true });
  };
  const { data: GroupDetails } = useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [search, setSearch] = useState("");
  const { t } = useTranslation();

  const clearFilter = () => setSearchParams({}, { replace: true });

  const expenses = data?.pages.flatMap((p) => p.items) ?? [];
  const totalCount = data?.pages[0]?.total ?? 0;
  const canLoadMore = hasNextPage;

  // Auto-fetch the next page when the sentinel scrolls near the viewport.
  // Disabled while a fetch is in flight so it can't fire twice for one page.
  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    onLoadMore: fetchNextPage,
    enabled: Boolean(canLoadMore) && !isFetching,
  });

  const role = GroupDetails?.role as string | undefined;

  const filtered = expenses?.filter((exp) => {
    const q = search.toLowerCase();
    return (
      exp.title.toLowerCase().includes(q) ||
      exp.category?.name?.toLowerCase().includes(q) ||
      exp.paidBy?.name?.toLowerCase().includes(q)
    );
  }) ?? [];

  const groups: { label: string; items: typeof expenses }[] = [];
  const seen = new Set<string>();
  filtered.forEach((exp) => {
    const label = dateLabel(exp.date);
    if (!seen.has(label)) {
      seen.add(label);
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1]!.items!.push(exp);
  });

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />

      <PageContainer width="content">
        <BackButton />

        <PageHeader
          accent="brand"
          icon={
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 3h10M2 7h7M2 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          }
          label={t("allExpenses.label")}
          title={t("allExpenses.title")}
          description={t("allExpenses.description")}
        />

        <div className={SPLIT}>
          {/* DOM order is rail-then-list so the totals and the active filter
              still come first when the grid collapses to one column on mobile.
              `order` only swaps them once there are two columns to swap. */}
          <aside className="space-y-3 min-w-0 lg:order-2 lg:sticky lg:top-10">
            {hasFilter && (
              <div className="flex items-center justify-between gap-3 bg-brand-50 border border-brand-200 dark:bg-brand-500/[0.08] dark:border-brand-400/20 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true">
                    <path
                      d="M1.5 2.5h11l-4.3 5v3.7l-2.4 1.3V7.5l-4.3-5Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-theme-xs text-brand-800 dark:text-brand-100/80 truncate" translate="no">
                    {filterLabel ?? t("allExpenses.filterActive", "Filtered")}
                  </span>
                </div>
                <button
                  onClick={clearFilter}
                  className="text-theme-xs font-semibold text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 shrink-0 transition-colors"
                >
                  {t("allExpenses.clearFilter", "Clear filter")}
                </button>
              </div>
            )}

            {/* Only meaningful once another group funds this one, so it stays
                out of the way entirely for groups with no connections. */}
            {funders.length > 0 && (
              <div className="rounded-xl border border-line bg-surface-raised px-4 py-3">
                <p className="text-theme-2xs font-semibold uppercase tracking-[0.14em] text-fg-muted mb-2">
                  {t("allExpenses.fundedByFilter", "Funded by")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Chip selected={!fundedBy} onClick={() => setFundedBy(undefined)}>
                    {t("allExpenses.fundedByAll", "All")}
                  </Chip>
                  <Chip selected={fundedBy === "own"} onClick={() => setFundedBy("own")}>
                    {t("allExpenses.fundedByOwn", "Own wallet")}
                  </Chip>
                  {funders.map((f) => (
                    <Chip
                      key={f.id}
                      selected={fundedBy === f.id}
                      onClick={() => setFundedBy(f.id)}
                    >
                      <span translate="no">{f.name}</span>
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {!isLoading && (
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <StatCard label={t("allExpenses.totalSpent")} value={total} currency />
                <StatCard
                  label={t("allExpenses.transactions")}
                  value={search ? filtered.length : totalCount}
                />
              </div>
            )}

            {!isLoading && (expenses?.length ?? 0) > 0 && (
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={t("allExpenses.searchPlaceholder")}
              />
            )}
          </aside>

          <div className="space-y-6 min-w-0 lg:order-1">

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

        {!isLoading && expenses?.length === 0 && (
          <div className="text-center py-16">
            <p className="text-fg-muted text-theme-sm">
              {hasFilter
                ? t("allExpenses.noFilterResults", "No expenses match this filter")
                : t("allExpenses.noExpensesYet")}
            </p>
            {hasFilter && (
              <button
                onClick={clearFilter}
                className="mt-2 text-brand-600 dark:text-brand-400 text-theme-xs hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
              >
                {t("allExpenses.clearFilter", "Clear filter")}
              </button>
            )}
          </div>
        )}

        {!isLoading && (expenses?.length ?? 0) > 0 && filtered.length === 0 && search && (
          <div className="text-center py-12">
            <p className="text-fg-muted text-theme-sm">{t("allExpenses.noResults", { search })}</p>
            <button
              onClick={() => setSearch("")}
              className="mt-2 text-brand-600 dark:text-brand-400 text-theme-xs hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              {t("allExpenses.clearSearch")}
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
                ₹{group.items!.reduce((s, e) => s + e.amount, 0).toLocaleString("en-IN")}
              </p>
            </div>

            {group.items!.map((expense, i) => (
              <ExpenseRow
                key={expense._id}
                expense={expense}
                onSelect={() => setSelectedExpense(expense)}
                ariaLabel={t("allExpenses.openExpense", "Open expense: {{title}}", { title: expense.title })}
                style={{
                  animation: "fadeSlideIn 0.22s ease forwards",
                  animationDelay: `${(gi * 3 + i) * 40}ms`,
                  opacity: 0,
                }}
              />
            ))}
          </div>
        ))}

        {!isLoading && canLoadMore && (
          <div ref={sentinelRef} className="space-y-2">
            {isFetching ? (
              [...Array(2)].map((_, i) => <ExpenseRowSkeleton key={i} />)
            ) : (
              <button
                onClick={() => fetchNextPage()}
                className="w-full py-2.5 rounded-xl border border-line text-fg-muted text-theme-xs font-semibold
                  hover:bg-surface-hover hover:text-fg active:bg-surface-hover transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                {t("allExpenses.loadMore", "Load more")}
              </button>
            )}
            <p className="text-center text-theme-2xs text-fg-muted">
              {t("allExpenses.showingCount", {
                shown: expenses.length,
                total: totalCount,
                defaultValue: `Showing ${expenses.length} of ${totalCount}`,
              })}
            </p>
          </div>
        )}
          </div>
        </div>
      </PageContainer>

      <ExpenseDetailModal
        expense={selectedExpense}
        onClose={() => setSelectedExpense(null)}
        role={role}
        groupId={groupId}
        group={GroupDetails}
      />
    </div>
  );
}
