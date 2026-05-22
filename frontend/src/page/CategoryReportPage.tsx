import { useMemo, useState } from 'react';
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
    DATE_INPUT_EXTRA,
} from '../components/ui';
import type { ReportPreset, CategoryBreakdownRow, TrendGranularity } from '../interface/report';
import { MIN_DATE, todayISODate, blockDateTyping } from '../helpers/validators';

const PRESETS: ReportPreset[] = ['this_month', 'last_month', 'all_time', 'custom'];

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

// Colours assigned to members by rank — members have no stored colour.
const MEMBER_COLORS = ['#818cf8', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb923c', '#a78bfa', '#4ade80'];

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

    let offset = 0;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={stroke}
            />
            {rows.map((row) => {
                const length = (row.totalCents / totalCents) * c;
                const dasharray = `${length} ${c - length}`;
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

    const [view, setView] = useState<ReportView>('category');
    const [preset, setPreset] = useState<ReportPreset>('this_month');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

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

    const skip = !groupId || (preset === 'custom' && (!startDate || !endDate));

    // Only the active tab's query runs; switching tabs serves cached data.
    const categoryQ = useGetCategoryBreakdownQuery(args, { skip: skip || view !== 'category' });
    const memberQ = useGetMemberBreakdownQuery(args, { skip: skip || view !== 'member' });
    const trendQ = useGetSpendTrendQuery(args, { skip: skip || view !== 'trend' });

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
        <div className="min-h-screen bg-[#080c14] text-white">
            <PageBackground />
            <Header />

            <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">
                <BackButton />

                <PageHeader
                    color="indigo"
                    icon={
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <circle cx="7" cy="7" r="5.5" stroke="#a5b4fc" strokeWidth="1.4" />
                            <path d="M7 1.5v5.5l4 3" stroke="#a5b4fc" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                    }
                    label={t('reports.label', 'Insights')}
                    title={t('reports.title', 'Spending Reports')}
                    description={t('reports.description', 'See how your group spends — by category, by member, and over time.')}
                />

                {/* view tabs + date range — sticks below the global header so
                    the view switch and the preset range stay reachable while
                    scrolling. */}
                <div className="sticky top-14 lg:top-16 z-20 -mx-4 px-4 py-2 bg-[#080c14]/95 backdrop-blur-md space-y-3">
                <div className="flex gap-1.5 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
                    {VIEWS.map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                                view === v
                                    ? 'bg-indigo-500/15 text-indigo-200'
                                    : 'text-white/40 hover:text-white/65 active:text-white/65'
                            }`}
                        >
                            {t(`reports.tab.${v}`, VIEW_LABEL[v])}
                        </button>
                    ))}
                </div>

                {/* date range selector */}
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map((p) => (
                            <button
                                key={p}
                                onClick={() => setPreset(p)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                    preset === p
                                        ? 'bg-indigo-500/15 border-indigo-400/35 text-indigo-200'
                                        : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60 active:text-white/60'
                                }`}
                            >
                                {t(`categoryReport.preset.${p}`)}
                            </button>
                        ))}
                    </div>
                    {preset === 'custom' && (
                        <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                                <span className="text-[10px] uppercase tracking-widest text-white/30">
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
                                    className={`mt-1 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 ${DATE_INPUT_EXTRA}`}
                                />
                            </label>
                            <label className="block">
                                <span className="text-[10px] uppercase tracking-widest text-white/30">
                                    {t('categoryReport.endDate')}
                                </span>
                                <input
                                    type="date"
                                    value={endDate}
                                    min={startDate || MIN_DATE}
                                    max={todayISODate()}
                                    onKeyDown={blockDateTyping}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className={`mt-1 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 ${DATE_INPUT_EXTRA}`}
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
                    <p className="text-[11px] text-white/30 px-0.5">
                        {formatDate(activeData.range.start, locale)} —{' '}
                        {formatDate(activeData.range.end, locale)}
                    </p>
                )}

                {(isLoading || isFetching) && !activeData && (
                    <div className="space-y-4">
                        <div className="h-[220px] bg-white/[0.04] rounded-2xl animate-pulse" />
                        <div className="space-y-2">
                            {[...Array(4)].map((_, i) => (
                                <div
                                    key={i}
                                    className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="w-3 h-3 rounded-full bg-white/[0.06] animate-pulse" />
                                        <div className="h-3 bg-white/[0.05] rounded animate-pulse w-1/3" />
                                    </div>
                                    <div className="h-4 w-16 bg-white/[0.05] rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl px-4 py-4 text-sm text-red-300">
                        {t('categoryReport.errorLoading')}
                    </div>
                )}

                {activeData && activeData.totalSpendCents === 0 && (
                    <div className="text-center py-16 space-y-2">
                        <p className="text-white/40 text-sm font-medium">{t('categoryReport.emptyTitle')}</p>
                        <p className="text-white/25 text-xs">{t('categoryReport.emptyHint')}</p>
                    </div>
                )}

                {/* CATEGORY view */}
                {view === 'category' && categoryQ.data && categoryQ.data.totalSpendCents > 0 && (
                    <>
                        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 flex flex-col items-center">
                            <Donut rows={categoryQ.data.categories} totalCents={categoryQ.data.totalSpendCents} />
                            <p className="text-[11px] uppercase tracking-widest text-white/30 mt-4">
                                {t('categoryReport.totalSpent')}
                            </p>
                            <p className="text-2xl font-semibold font-mono text-[#f0eeff] mt-1" translate="no">
                                {formatCents(categoryQ.data.totalSpendCents, locale)}
                            </p>
                        </div>

                        <div className="space-y-2">
                            {categoryQ.data.categories.map((row, i) => (
                                <button
                                    key={row.categoryId}
                                    onClick={() => goToExpenses({ categoryId: row.categoryId, label: row.name })}
                                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5 flex items-center justify-between hover:bg-white/[0.05] hover:border-white/[0.12] active:bg-white/[0.05] active:border-white/[0.12] transition-colors text-left"
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
                                                className={`text-[13px] font-medium truncate leading-tight ${
                                                    row.isDeleted ? 'text-white/40 italic' : 'text-white/80'
                                                }`}
                                                translate="no"
                                            >
                                                {row.name}
                                                {row.isDeleted && (
                                                    <span className="ml-2 text-[9px] uppercase tracking-widest text-white/30">
                                                        {t('categoryReport.deleted')}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[10px] text-white/30 mt-0.5">
                                                {t('categoryReport.expenseCount', { count: row.expenseCount })} ·{' '}
                                                {row.sharePct.toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                    <p
                                        className="text-[15px] font-semibold font-mono text-[#f0eeff] shrink-0 ml-3"
                                        translate="no"
                                    >
                                        {formatCents(row.totalCents, locale)}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* MEMBER view */}
                {view === 'member' && memberQ.data && memberQ.data.totalSpendCents > 0 && (
                    <div className="space-y-2">
                        {memberQ.data.members.map((m, i) => {
                            const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
                            return (
                                <button
                                    key={m.userId}
                                    onClick={() => goToExpenses({ paidBy: m.userId, label: m.name })}
                                    className="w-full text-left bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5 hover:bg-white/[0.05] hover:border-white/[0.12] active:bg-white/[0.05] active:border-white/[0.12] transition-colors"
                                    style={{
                                        animation: 'fadeSlideIn 0.22s ease forwards',
                                        animationDelay: `${i * 40}ms`,
                                        opacity: 0,
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                                                style={{ background: color + '22', color }}
                                                translate="no"
                                            >
                                                {initials(m.name)}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-medium text-white/80 truncate leading-tight" translate="no">
                                                    {m.name}
                                                </p>
                                                <p className="text-[10px] text-white/30 mt-0.5">
                                                    {t('categoryReport.expenseCount', { count: m.expenseCount })} ·{' '}
                                                    {m.sharePct.toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                        <p
                                            className="text-[15px] font-semibold font-mono text-[#f0eeff] shrink-0 ml-3"
                                            translate="no"
                                        >
                                            {formatCents(m.totalCents, locale)}
                                        </p>
                                    </div>
                                    <div className="mt-2.5 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
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

                {/* TREND view */}
                {view === 'trend' && trendData && trendData.totalSpendCents > 0 && (
                    <>
                        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
                            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">
                                {t(
                                    `reports.granularity.${trendData.granularity}`,
                                    GRANULARITY_LABEL[trendData.granularity]
                                )}
                            </p>
                            <div className="flex items-end gap-1.5 h-40">
                                {trendData.points.map((p) => {
                                    const h = Math.max((p.totalCents / maxTrendCents) * 100, 4);
                                    return (
                                        <div
                                            key={p.periodStart}
                                            className="flex-1 flex items-end h-full min-w-0"
                                            title={`${formatPeriod(p.periodStart, trendData.granularity, locale)}: ${formatCents(p.totalCents, locale)}`}
                                        >
                                            <div
                                                className="w-full rounded-t bg-gradient-to-t from-indigo-500/40 to-indigo-400/80"
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
                                    className="w-full text-left bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 flex items-center justify-between hover:bg-white/[0.05] hover:border-white/[0.12] active:bg-white/[0.05] active:border-white/[0.12] transition-colors"
                                    style={{
                                        animation: 'fadeSlideIn 0.22s ease forwards',
                                        animationDelay: `${i * 40}ms`,
                                        opacity: 0,
                                    }}
                                >
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-medium text-white/80 leading-tight" translate="no">
                                            {formatPeriod(p.periodStart, trendData.granularity, locale)}
                                        </p>
                                        <p className="text-[10px] text-white/30 mt-0.5">
                                            {t('categoryReport.expenseCount', { count: p.expenseCount })}
                                        </p>
                                    </div>
                                    <p
                                        className="text-[15px] font-semibold font-mono text-[#f0eeff] shrink-0 ml-3"
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
