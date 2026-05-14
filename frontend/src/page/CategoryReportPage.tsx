import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../components/header';
import { useGetCategoryBreakdownQuery } from '../redux/api/report';
import {
    PageBackground,
    BackButton,
    PageHeader,
    StatCard,
} from '../components/ui';
import type { ReportPreset, CategoryBreakdownRow } from '../interface/report';

const PRESETS: ReportPreset[] = ['this_month', 'last_month', 'all_time', 'custom'];

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

    const { data, isLoading, isFetching, error } = useGetCategoryBreakdownQuery(args, { skip });

    const goToExpenses = (categoryId: string) => {
        if (!data) return;
        const params = new URLSearchParams({
            categoryId,
            start: data.range.start,
            end: data.range.end,
        });
        navigate(`/groups/${groupId}/expenses?${params.toString()}`);
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
                    label={t('categoryReport.label')}
                    title={t('categoryReport.title')}
                    description={t('categoryReport.description')}
                />

                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map((p) => (
                            <button
                                key={p}
                                onClick={() => setPreset(p)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                    preset === p
                                        ? 'bg-indigo-500/15 border-indigo-400/35 text-indigo-200'
                                        : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60'
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
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="mt-1 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80"
                                />
                            </label>
                            <label className="block">
                                <span className="text-[10px] uppercase tracking-widest text-white/30">
                                    {t('categoryReport.endDate')}
                                </span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="mt-1 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80"
                                />
                            </label>
                        </div>
                    )}
                </div>

                {data && (
                    <div className="grid grid-cols-2 gap-2">
                        <StatCard
                            label={t('categoryReport.totalSpent')}
                            value={data.totalSpendCents / 100}
                            currency
                        />
                        <StatCard label={t('categoryReport.transactions')} value={data.expenseCount} />
                    </div>
                )}

                {data && (
                    <p className="text-[11px] text-white/30 px-0.5">
                        {formatDate(data.range.start, locale)} — {formatDate(data.range.end, locale)}
                    </p>
                )}

                {(isLoading || isFetching) && !data && (
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

                {data && data.totalSpendCents === 0 && (
                    <div className="text-center py-16 space-y-2">
                        <p className="text-white/40 text-sm font-medium">{t('categoryReport.emptyTitle')}</p>
                        <p className="text-white/25 text-xs">{t('categoryReport.emptyHint')}</p>
                    </div>
                )}

                {data && data.totalSpendCents > 0 && (
                    <>
                        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 flex flex-col items-center">
                            <Donut rows={data.categories} totalCents={data.totalSpendCents} />
                            <p className="text-[11px] uppercase tracking-widest text-white/30 mt-4">
                                {t('categoryReport.totalSpent')}
                            </p>
                            <p className="text-2xl font-semibold font-mono text-[#f0eeff] mt-1" translate="no">
                                {formatCents(data.totalSpendCents, locale)}
                            </p>
                        </div>

                        <div className="space-y-2">
                            {data.categories.map((row, i) => (
                                <button
                                    key={row.categoryId}
                                    onClick={() => goToExpenses(row.categoryId)}
                                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5 flex items-center justify-between hover:bg-white/[0.05] hover:border-white/[0.12] transition-colors text-left"
                                    style={{
                                        animation: 'fadeSlideIn 0.22s ease forwards',
                                        animationDelay: `${i * 40}ms`,
                                        opacity: 0,
                                    }}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span
                                            className="w-3 h-3 rounded-full shrink-0"
                                            style={{
                                                background: row.color,
                                                opacity: row.isDeleted ? 0.4 : 1,
                                            }}
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
