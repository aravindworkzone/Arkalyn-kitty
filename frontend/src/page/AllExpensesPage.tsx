import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Header from "../components/header";
import { useGetAllExpensesInfiniteQuery } from "../redux/api/expense";
import { useGetGroupByIdQuery } from "../redux/api/group";
import ExpenseDetailModal from "../components/ExpenseDetailModal";
import ExpenseRow, { ExpenseRowSkeleton } from "../components/expense/ExpenseRow";
import { dateLabel } from "../helpers/formatters";
import {
  PageBackground,
  BackButton,
  PageHeader,
  StatCard,
  SearchInput,
} from "../components/ui";
import { useTranslation } from "react-i18next";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

export default function AllExpensesPage() {
  const { groupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters arrive as URL params when the user drills in from a report card.
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const paidBy = searchParams.get("paidBy") ?? undefined;
  const spender = searchParams.get("spender") ?? undefined;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;
  const filterLabel = searchParams.get("label") ?? undefined;
  const hasFilter = Boolean(categoryId || paidBy || spender || startDate || endDate);

  // A changed filter changes the query arg, so RTK Query starts a fresh
  // page set automatically — no manual reset needed.
  const { data, isLoading, isFetching, hasNextPage, fetchNextPage } =
    useGetAllExpensesInfiniteQuery(
      { groupId: groupId!, categoryId, paidBy, spender, startDate, endDate },
      { skip: !groupId }
    );
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
      <Header />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">
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

        {hasFilter && (
          <div className="flex items-center justify-between gap-3 bg-brand-50 border border-brand-200 dark:bg-brand-500/[0.08] dark:border-brand-400/20 rounded-xl px-3.5 py-2.5">
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

        {!isLoading && (
          <div className="grid grid-cols-2 gap-2">
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
      </main>

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
