import type { ReactNode } from "react";
import { cn } from "../../helpers/cn";

/**
 * Container for a list of records: loading -> empty -> rows, with an optional
 * server-driven pagination footer.
 *
 * WHY THIS AND NOT A DATATABLE. UI_PROMPT asks for a data table with sortable
 * column headers, client pagination, row selection and CSV export. This app has
 * no tabular data — the only <table> is the marketing plan grid on
 * SubscriptionPlansPage. What the admin sections actually render is stacked
 * rows, and their search / filter / sort / pagination are all SERVER-side
 * (`useGetAdminUsersQuery({ page, limit, search, status, plan, sort })`, whose
 * sort accepts only `newest | oldest`). A client-side table would fight that
 * contract, per-column sort would need new backend sort keys, and CSV export
 * would need an unbounded endpoint that does not exist — exporting the current
 * 20-row page as "the data" is worse than not offering it.
 *
 * So this covers the part that genuinely repeats: the same
 * loading/empty/rows/footer scaffolding is hand-written in UsersSection,
 * PromosSection and the promo-redemptions modal today.
 */

export interface DataListPagination {
    page: number;
    totalPages: number;
    /** Total record count, for the "N users" summary. */
    total?: number;
    /** Plural noun for that summary — "users", "codes". */
    unitLabel?: string;
    onPageChange: (page: number) => void;
    /** Disables the arrows during a refetch without collapsing the rows. */
    busy?: boolean;
}

interface DataListProps {
    isLoading?: boolean;
    /** Skeleton rows drawn while loading — match the real row count to avoid layout jump. */
    loadingRows?: number;
    isEmpty?: boolean;
    emptyLabel?: ReactNode;
    error?: string;
    /** Hairlines between rows. Off when rows are self-contained cards. */
    divided?: boolean;
    /** Card surface around the rows. Off when already inside a Card/Panel. */
    bordered?: boolean;
    pagination?: DataListPagination;
    className?: string;
    children?: ReactNode;
}

export default function DataList({
    isLoading = false,
    loadingRows = 5,
    isEmpty = false,
    emptyLabel = "Nothing here yet.",
    error,
    divided = true,
    bordered = true,
    pagination,
    className,
    children,
}: DataListProps) {
    const surface = bordered
        ? "rounded-2xl border border-line bg-surface-raised overflow-hidden"
        : undefined;

    let body: ReactNode;

    if (isLoading) {
        body = (
            <div className={cn(divided && "divide-y divide-line")} aria-busy="true" aria-live="polite">
                {Array.from({ length: loadingRows }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1 space-y-2">
                            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-hover" />
                            <div className="h-2.5 w-1/2 animate-pulse rounded bg-surface-hover" />
                        </div>
                        <div className="h-5 w-14 shrink-0 animate-pulse rounded-full bg-surface-hover" />
                    </div>
                ))}
                <span className="sr-only">Loading…</span>
            </div>
        );
    } else if (error) {
        body = (
            <p role="alert" className="px-4 py-8 text-center text-theme-sm text-error-600 dark:text-error-400">
                {error}
            </p>
        );
    } else if (isEmpty) {
        body = <p className="px-4 py-10 text-center text-theme-sm text-fg-muted">{emptyLabel}</p>;
    } else {
        body = <div className={cn(divided && "divide-y divide-line")}>{children}</div>;
    }

    return (
        <div className={cn("space-y-3", className)}>
            <div className={surface}>{body}</div>

            {pagination && !isLoading && !isEmpty && (
                <Pagination {...pagination} />
            )}
        </div>
    );
}

function Pagination({
    page,
    totalPages,
    total,
    unitLabel = "records",
    onPageChange,
    busy = false,
}: DataListPagination) {
    const atStart = page <= 1;
    const atEnd = page >= totalPages;

    const arrow =
        "rounded-lg px-2 py-1 text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 " +
        "disabled:pointer-events-none disabled:opacity-30";

    return (
        <nav
            aria-label="Pagination"
            className="flex items-center justify-between gap-3 text-theme-xs text-fg-muted"
        >
            <span>{total !== undefined ? `${total} ${unitLabel}` : `Page ${page} of ${totalPages}`}</span>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={atStart || busy}
                    onClick={() => onPageChange(page - 1)}
                    className={arrow}
                >
                    ← Prev
                </button>
                <span aria-live="polite" className="tabular-nums">
                    {page} / {totalPages}
                </span>
                <button
                    type="button"
                    disabled={atEnd || busy}
                    onClick={() => onPageChange(page + 1)}
                    className={arrow}
                >
                    Next →
                </button>
            </div>
        </nav>
    );
}
