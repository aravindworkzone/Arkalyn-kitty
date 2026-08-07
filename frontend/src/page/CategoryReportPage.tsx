import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../components/header';
import {
    useGetCategoryBreakdownQuery,
    useGetMemberBreakdownQuery,
    useGetSpendTrendQuery,
} from '../redux/api/report';
import {
    PageBackground,
    BackButton,
    PageHeader,
    StatCard,
    SegmentedToggle,
    INPUT_CLASS,
    DATE_INPUT_EXTRA,
} from '../components/ui';
import type { ReportPreset, CategoryBreakdownRow, TrendGranularity, MemberBy } from '../interface/report';
import { MIN_DATE, todayISODate, blockDateTyping } from '../helpers/validators';
import { seriesColor } from '../helpers/chartPalette';
import { usePlan } from '../hooks/usePlan';
import { useGetGroupByIdQuery } from '../redux/api/group';

const PRESETS: ReportPreset[] = ['this_month', 'last_month', 'all_time', 'custom'];
// A closed group is frozen in time, so relative ranges (this/last month) are
// meaningless — only the absolute ranges remain.
const CLOSED_PRESETS: ReportPreset[] = ['all_time', 'custom'];

const VIEWS = ['category', 'member', 'trend'] as const;
type ReportView = (typeof VIEWS)[number];
const VIEW_LABEL: Record<ReportView, string> = {
    category: 'Category',
    member: 'By member',
    trend: 'Trend',
};

const GRANULARITY_LABEL: Record<TrendGranularity, string> = {
    day: 'Daily',
    week: 'Weekly',
    month: 'Monthly',
};

// Members have no stored colour, so they take the shared categorical sequence
// by rank. seriesColor assigns in fixed order and does NOT cycle — a 9th member
// gets the neutral "Other" grey rather than reusing hue 1, which would read as
// "same person as the first row".

const formatCents = (cents: number, locale: string) =>
    new Intl.NumberFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(cents / 100);

const formatDate = (iso: string, locale: string) =>
    new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(iso));

const formatPeriod = (iso: string, granularity: TrendGranularity, locale: string) => {
    const loc = locale === 'ta' ? 'ta-IN' : 'en-IN';
    const opts: Intl.DateTimeFormatOptions =
        granularity === 'month'
            ? { month: 'short', year: '2-digit' }
            : { day: '2-digit', month: 'short' };
    return new Intl.DateTimeFormat(loc, opts).format(new Date(iso));
};

// Inclusive end of a trend bucket. periodStart comes from MongoDB $dateTrunc (UTC),
// so step a whole day/week/month forward in UTC, then back 1ms.
const trendPeriodEnd = (iso: string, granularity: TrendGranularity): string => {
    const d = new Date(iso);
    if (granularity === 'day') d.setUTCDate(d.getUTCDate() + 1);
    else if (granularity === 'week') d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
    return new Date(d.getTime() - 1).toISOString();
};

const initials = (name: string) =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || '?';

interface DonutProps {
    rows: CategoryBreakdownRow[];
    totalCents: number;
}

function Donut({ rows, totalCents }: DonutProps) {
    const size = 220;
    const stroke = 28;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    // 2px of surface between adjacent fills so neighbouring segments stay
    // separable without relying on their colours differing enough.
    const GAP = 2;

    let offset = 0;
    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90"
            role="img"
            aria-label="Spending by category"
        >
            {/* Track — `currentColor` so it follows the surrounding text colour
                and therefore the theme; an rgba literal was invisible on light. */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                className="text-line"
                stroke="currentColor"
                strokeWidth={stroke}
            />
            {rows.map((row) => {
                const length = (row.totalCents / totalCents) * c;
                // Never let the gap eat a sliver segment entirely.
                const drawn = Math.max(length - GAP, 1);
                const dasharray = `${drawn} ${c - drawn}`;
                const dashoffset = -offset;
                offset += length;
                return (
                    <circle
                        key={row.categoryId}
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        fill="none"
                        stroke={row.color}
                        strokeWidth={stroke}
                        strokeDasharray={dasharray}
                        strokeDashoffset={dashoffset}
                        opacity={row.isDeleted ? 0.4 : 1}
                    />
                );
            })}
        </svg>
    );
}

export default function CategoryReportPage() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const locale = i18n.language;

    const { features } = usePlan();

    const { data: group } = useGetGroupByIdQuery(groupId!, { skip: !groupId });
    const isClosed = group?.status === 'CLOSED';
    // Closed groups are read-only history: the advanced ranges are always
    // available regardless of the frozen tier (no dead-end), and the relative
    // presets are dropped entirely.
    const canAdvancedRange = isClosed || features.advancedReportRange;
    const presets = isClosed ? CLOSED_PRESETS : PRESETS;

    const [view, setView] = useState<ReportView>('category');
    // Member tab: attribute by who paid, or who the spend was for (split shares).
    const [memberBy, setMemberBy] = useState<MemberBy>('spent');
    const [preset, setPreset] = useState<ReportPreset>('this_month');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

    const toggleHiddenCategory = (categoryId: string) => {
        setHiddenCategories((prev) => {
            const next = new Set(prev);
            if (next.has(categoryId)) next.delete(categoryId);
            else next.add(categoryId);
            return next;
        });
    };

    // A closed group has no this/last-month view — default such groups to All time.
    useEffect(() => {
        if (isClosed && (preset === 'this_month' || preset === 'last_month')) {
            setPreset('all_time');
        }
    }, [isClosed, preset]);

    const args = useMemo(
        () => ({
            groupId: groupId!,
            preset,
            ...(preset === 'custom'
                ? {
                      startDate: startDate ? new Date(startDate).toISOString() : undefined,
                      endDate: endDate ? new Date(endDate).toISOString() : undefined,
                  }
                : {}),
        }),
        [groupId, preset, startDate, endDate]
    );

    const memberArgs = useMemo(() => ({ ...args, by: memberBy }), [args, memberBy]);

    const skip = !groupId || (preset === 'custom' && (!startDate || !endDate));

    // Only the active tab's query runs; switching tabs serves cached data.
    const categoryQ = useGetCategoryBreakdownQuery(args, { skip: skip || view !== 'category' });
    const memberQ = useGetMemberBreakdownQuery(memberArgs, { skip: skip || view !== 'member' });
    const trendQ = useGetSpendTrendQuery(args, { skip: skip || view !== 'trend' });

    const visibleRows = useMemo(
        () => categoryQ.data?.categories.filter((row) => !hiddenCategories.has(row.categoryId)) ?? [],
        [categoryQ.data, hiddenCategories]
    );
    const visibleTotalCents = useMemo(
        () => visibleRows.reduce((s, r) => s + r.totalCents, 0),
        [visibleRows]
    );

    const activeQ = view === 'category' ? categoryQ : view === 'member' ? memberQ : trendQ;
    const activeData = activeQ.data;
    const { isLoading, isFetching, error } = activeQ;

    const trendData = trendQ.data;
    const maxTrendCents = trendData
        ? Math.max(...trendData.points.map((p) => p.totalCents), 1)
        : 1;

    // Drill into the expense list: redirect to All Expenses with a server-side
    // filter (category, member, or date range) plus a human label for the chip.
    const goToExpenses = (params: Record<string, string>) => {
        navigate(`/groups/${groupId}/expenses?${new URLSearchParams(params).toString()}`);
    };

    return (
        <div className="min-h-screen bg-surface text-fg">
            <PageBackground />
            <Header />

            <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">
                <div className="inline-block">
                    <BackButton />
                </div>

                <PageHeader
                    accent="brand"
                    icon={
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                            <path d="M7 1.5v5.5l4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                    }
                    label={t('reports.label', 'Insights')}
                    title={t('reports.title', 'Spending Reports')}
                    description={t('reports.description', 'See how your group spends — by category, by member, and over time.')}
                />

                {/* view tabs + date range — sticks below the global header so
                    the view switch and the preset range stay reachable while
                    scrolling. */}
                <div className="sticky top-14 lg:top-16 z-sticky -mx-4 px-4 py-2 bg-surface/95 backdrop-blur-md space-y-3">
                <SegmentedToggle
                    className="w-full [&>button]:flex-1"
                    options={VIEWS.map((v) => ({ value: v, label: t(`reports.tab.${v}`, VIEW_LABEL[v]) }))}
                    value={view}
                    onChange={setView}
                    ariaLabel={t('reports.title', 'Spending Reports')}
                />

                {/* date range selector */}
                <div className="bg-surface-raised border border-line rounded-xl p-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {presets.map((p) => {
                            const locked = !canAdvancedRange && (p === 'all_time' || p === 'custom');
                            return (
                            <button
                                key={p}
                                onClick={() => (locked ? navigate('/pricing') : setPreset(p))}
                                title={locked ? t('reports.upgradeRange', 'All-time & custom ranges need Pro') : undefined}
                                aria-pressed={!locked && preset === p}
                                className={`px-3 py-1.5 rounded-lg text-theme-xs font-semibold border transition-colors inline-flex items-center gap-1
                                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                                    locked
                                        ? 'bg-surface-raised border-line text-fg-muted hover:text-brand-600 dark:hover:text-brand-400'
                                        : preset === p
                                        ? 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-500/15 dark:border-brand-400/35 dark:text-brand-200'
                                        : 'bg-surface-raised border-line text-fg-muted hover:text-fg active:text-fg'
                                }`}
                            >
                                {t(`categoryReport.preset.${p}`)}
                                {locked && (
                                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                        <rect x="2" y="4.5" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1" />
                                        <path d="M3.5 4.5V3.2a1.5 1.5 0 013 0v1.3" stroke="currentColor" strokeWidth="1" />
                                    </svg>
                                )}
                            </button>
                            );
                        })}
                    </div>
                    {preset === 'custom' && (
                        <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                                <span className="text-theme-2xs uppercase tracking-widest text-fg-muted">
                                    {t('categoryReport.startDate')}
                                </span>
                                <input
                                    type="date"
                                    value={startDate}
                                    min={MIN_DATE}
                                    max={endDate || todayISODate()}
                                    onKeyDown={blockDateTyping}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setStartDate(v);
                                        // Keep the range coherent: a "to" earlier
                                        // than the new "from" is snapped forward.
                                        if (endDate && v && endDate < v) setEndDate(v);
                                    }}
                                    className={`mt-1 ${INPUT_CLASS} ${DATE_INPUT_EXTRA}`}
                                />
                            </label>
                            <label className="block">
                                <span className="text-theme-2xs uppercase tracking-widest text-fg-muted">
                                    {t('categoryReport.endDate')}
                                </span>
                                <input
                                    type="date"
                                    value={endDate}
                                    min={startDate || MIN_DATE}
                                    max={todayISODate()}
                                    onKeyDown={blockDateTyping}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className={`mt-1 ${INPUT_CLASS} ${DATE_INPUT_EXTRA}`}
                                />
                            </label>
                        </div>
                    )}
                </div>
                </div>

                {activeData && (
                    <div className="grid grid-cols-2 gap-2">
                        <StatCard
                            label={t('categoryReport.totalSpent')}
                            value={activeData.totalSpendCents / 100}
                            currency
                        />
                        <StatCard
                            label={t('categoryReport.transactions')}
                            value={activeData.expenseCount}
                        />
                    </div>
                )}

                {activeData && (
                    <p className="text-theme-xs text-fg-muted px-0.5">
                        {formatDate(activeData.range.start, locale)} —{' '}
                        {formatDate(activeData.range.end, locale)}
                    </p>
                )}

                {(isLoading || isFetching) && !activeData && (
                    <div className="space-y-4">
                        <div className="h-[220px] bg-surface-hover rounded-2xl animate-pulse" />
                        <div className="space-y-2">
                            {[...Array(4)].map((_, i) => (
                                <div
                                    key={i}
                                    className="bg-surface-raised border border-line rounded-xl px-4 py-3.5 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="w-3 h-3 rounded-full bg-line animate-pulse" />
                                        <div className="h-3 bg-line rounded animate-pulse w-1/3" />
                                    </div>
                                    <div className="h-4 w-16 bg-line rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-error-50 border border-error-200 dark:bg-error-500/[0.06] dark:border-error-500/15 rounded-xl px-4 py-4 text-theme-sm text-error-700 dark:text-error-300">
                        {t('categoryReport.errorLoading')}
                    </div>
                )}

                {activeData && activeData.totalSpendCents === 0 &&
                    !(view === 'member' && memberQ.data && memberQ.data.specialCategories.length > 0) && (
                    <div className="text-center py-16 space-y-2">
                        <p className="text-fg text-theme-sm font-medium">{t('categoryReport.emptyTitle')}</p>
                        <p className="text-fg-muted text-theme-xs">{t('categoryReport.emptyHint')}</p>
                    </div>
                )}

                {/* CATEGORY view */}
                {view === 'category' && categoryQ.data && categoryQ.data.totalSpendCents > 0 && (
                    <>
                        <div className="bg-surface-raised border border-line rounded-2xl p-6 flex flex-col items-center shadow-theme-xs">
                            <Donut rows={visibleRows} totalCents={visibleTotalCents || 1} />
                            <p className="text-theme-xs uppercase tracking-widest text-fg-muted mt-4">
                                {t('categoryReport.totalSpent')}
                            </p>
                            <p className="text-title-sm font-semibold font-mono text-fg mt-1" translate="no">
                                {formatCents(visibleTotalCents, locale)}
                            </p>
                            {/* Legend — always present, and each row is also
                                direct-labelled in the list below, so identity is
                                never carried by colour alone. */}
                            <div className="flex flex-wrap justify-center gap-1.5 mt-5 w-full">
                                {categoryQ.data.categories.map((row) => {
                                    const hidden = hiddenCategories.has(row.categoryId);
                                    return (
                                        <button
                                            key={row.categoryId}
                                            onClick={() => toggleHiddenCategory(row.categoryId)}
                                            aria-pressed={!hidden}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-theme-2xs font-medium transition-all duration-200
                                                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                                                hidden
                                                    ? 'bg-surface-raised text-fg-muted'
                                                    : 'bg-surface-hover text-fg'
                                            }`}
                                        >
                                            <span
                                                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                                    hidden ? 'opacity-20' : 'opacity-100'
                                                }`}
                                                style={{ background: row.color }}
                                            />
                                            <span className={hidden ? 'line-through' : ''}>{row.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {categoryQ.data.categories.map((row, i) => (
                                <button
                                    key={row.categoryId}
                                    onClick={() => goToExpenses({ categoryId: row.categoryId, label: row.name })}
                                    className="w-full bg-surface-raised border border-line rounded-xl px-4 py-3.5 shadow-theme-xs
                                        flex items-center justify-between hover:bg-surface-hover hover:border-line-strong transition-colors text-left
                                        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                                    style={{
                                        animation: 'fadeSlideIn 0.22s ease forwards',
                                        animationDelay: `${i * 40}ms`,
                                        opacity: 0,
                                    }}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span
                                            className="w-3 h-3 rounded-full shrink-0"
                                            style={{ background: row.color, opacity: row.isDeleted ? 0.4 : 1 }}
                                        />
                                        <div className="min-w-0">
                                            <p
                                                className={`text-theme-sm font-medium truncate leading-tight ${
                                                    row.isDeleted ? 'text-fg-muted italic' : 'text-fg'
                                                }`}
                                                translate="no"
                                            >
                                                {row.name}
                                                {row.isDeleted && (
                                                    <span className="ml-2 text-theme-2xs uppercase tracking-widest text-fg-muted">
                                                        {t('categoryReport.deleted')}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-theme-2xs text-fg-muted mt-0.5">
                                                {t('categoryReport.expenseCount', { count: row.expenseCount })} ·{' '}
                                                {row.sharePct.toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                    <p
                                        className="text-theme-sm font-semibold font-mono text-fg shrink-0 ml-3"
                                        translate="no"
                                    >
                                        {formatCents(row.totalCents, locale)}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* MEMBER view: paid vs spent toggle */}
                {view === 'member' && (
                    <SegmentedToggle
                        className="w-full [&>button]:flex-1"
                        options={[
                            { value: 'spent', label: t('categoryReport.whoSpent', 'Who spent') },
                            { value: 'paid',  label: t('categoryReport.whoPaid', 'Who paid') },
                        ]}
                        value={memberBy}
                        onChange={(v) => setMemberBy(v as MemberBy)}
                        ariaLabel={t('reports.tab.member', 'By member')}
                    />
                )}

                {/* MEMBER view */}
                {view === 'member' && memberQ.data && memberQ.data.totalSpendCents > 0 && (
                    <div className="space-y-2">
                        {memberQ.data.members.map((m, i) => {
                            const color = seriesColor(i);
                            return (
                                <button
                                    key={m.userId}
                                    onClick={() =>
                                        goToExpenses(
                                            memberBy === 'paid'
                                                ? { paidBy: m.userId, label: m.name }
                                                : { spender: m.userId, label: m.name }
                                        )
                                    }
                                    className="w-full text-left bg-surface-raised border border-line rounded-xl px-4 py-3.5 shadow-theme-xs
                                        hover:bg-surface-hover hover:border-line-strong transition-colors
                                        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                                    style={{
                                        animation: 'fadeSlideIn 0.22s ease forwards',
                                        animationDelay: `${i * 40}ms`,
                                        opacity: 0,
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-theme-xs font-semibold shrink-0"
                                                style={{ background: color + '22', color }}
                                                translate="no"
                                            >
                                                {initials(m.name)}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-theme-sm font-medium text-fg truncate leading-tight" translate="no">
                                                    {m.name}
                                                </p>
                                                <p className="text-theme-2xs text-fg-muted mt-0.5">
                                                    {memberBy === 'paid' && (
                                                        <>
                                                            {t('categoryReport.expenseCount', { count: m.expenseCount })} ·{' '}
                                                        </>
                                                    )}
                                                    {m.sharePct.toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                        <p
                                            className="text-theme-sm font-semibold font-mono text-fg shrink-0 ml-3"
                                            translate="no"
                                        >
                                            {formatCents(m.totalCents, locale)}
                                        </p>
                                    </div>
                                    <div className="mt-2.5 h-1.5 rounded-full bg-line overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${Math.max(m.sharePct, 2)}%`, background: color }}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* MEMBER view — collective / special categories (not attributed per member) */}
                {view === 'member' && memberQ.data && memberQ.data.specialCategories.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1 pt-1">
                            <p className="text-theme-2xs font-semibold uppercase tracking-widest text-fg-muted">
                                {t('categoryReport.collective', 'Shared / collective')}
                            </p>
                            <p className="text-theme-xs font-mono text-fg-muted" translate="no">
                                {formatCents(memberQ.data.specialTotalCents, locale)}
                            </p>
                        </div>
                        {memberQ.data.specialCategories.map((c) => (
                            <button
                                key={c.categoryId}
                                onClick={() => goToExpenses({ categoryId: c.categoryId, label: c.name })}
                                className="w-full text-left bg-warning-50 border border-warning-200 dark:bg-warning-500/[0.05] dark:border-warning-500/15
                                    rounded-xl px-4 py-3 hover:bg-warning-100 dark:hover:bg-warning-500/[0.09] transition-colors
                                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                                        <div className="min-w-0">
                                            <p className="text-theme-sm font-medium text-fg truncate leading-tight" translate="no">{c.name}</p>
                                            <p className="text-theme-2xs text-fg-muted mt-0.5">
                                                {t('categoryReport.collectiveHint', 'Collective — not split per member')}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-theme-sm font-semibold font-mono text-warning-800 dark:text-warning-200/90 shrink-0 ml-3" translate="no">
                                        {formatCents(c.totalCents, locale)}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* TREND view */}
                {view === 'trend' && trendData && trendData.totalSpendCents > 0 && (
                    <>
                        <div className="bg-surface-raised border border-line rounded-2xl p-5 shadow-theme-xs">
                            <p className="text-theme-2xs uppercase tracking-widest text-fg-muted mb-3">
                                {t(
                                    `reports.granularity.${trendData.granularity}`,
                                    GRANULARITY_LABEL[trendData.granularity]
                                )}
                            </p>
                            {/* One series over time, so no legend — the label above
                                names it. Flat brand fill rather than a gradient:
                                a fading bar reads as a value that trails off.
                                Rounded top only, anchored to the baseline. */}
                            <div className="flex items-end gap-1.5 h-40">
                                {trendData.points.map((p) => {
                                    const h = Math.max((p.totalCents / maxTrendCents) * 100, 4);
                                    return (
                                        <div
                                            key={p.periodStart}
                                            className="flex-1 flex items-end h-full min-w-0 group/bar"
                                            title={`${formatPeriod(p.periodStart, trendData.granularity, locale)}: ${formatCents(p.totalCents, locale)}`}
                                        >
                                            <div
                                                className="w-full rounded-t-[4px] bg-brand-500 transition-colors group-hover/bar:bg-brand-600"
                                                style={{ height: `${h}%` }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {[...trendData.points].reverse().map((p, i) => (
                                <button
                                    key={p.periodStart}
                                    onClick={() =>
                                        goToExpenses({
                                            startDate: p.periodStart,
                                            endDate: trendPeriodEnd(p.periodStart, trendData.granularity),
                                            label: formatPeriod(p.periodStart, trendData.granularity, locale),
                                        })
                                    }
                                    className="w-full text-left bg-surface-raised border border-line rounded-xl px-4 py-3 shadow-theme-xs
                                        flex items-center justify-between hover:bg-surface-hover hover:border-line-strong transition-colors
                                        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                                    style={{
                                        animation: 'fadeSlideIn 0.22s ease forwards',
                                        animationDelay: `${i * 40}ms`,
                                        opacity: 0,
                                    }}
                                >
                                    <div className="min-w-0">
                                        <p className="text-theme-sm font-medium text-fg leading-tight" translate="no">
                                            {formatPeriod(p.periodStart, trendData.granularity, locale)}
                                        </p>
                                        <p className="text-theme-2xs text-fg-muted mt-0.5">
                                            {t('categoryReport.expenseCount', { count: p.expenseCount })}
                                        </p>
                                    </div>
                                    <p
                                        className="text-theme-sm font-semibold font-mono text-fg shrink-0 ml-3"
                                        translate="no"
                                    >
                                        {formatCents(p.totalCents, locale)}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </main>

            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
