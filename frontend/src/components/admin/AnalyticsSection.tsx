import { useState } from 'react';
import { useGetAnalyticsQuery } from '../../redux/api/admin';
import { StatCard, Bars, Panel, fmtINR } from './adminUi';

const GRANS = ['day', 'week', 'month'] as const;

export default function AnalyticsSection() {
    const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('month');
    const { data, isLoading } = useGetAnalyticsQuery({ granularity });

    if (isLoading || !data) {
        return <div className="h-64 rounded-2xl bg-surface-raised border border-line animate-pulse" />;
    }

    const signupBars = data.signups.map((s) => ({
        label: new Date(s.period).toLocaleDateString(
            'en-IN',
            granularity === 'month' ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' }
        ),
        value: s.count,
    }));
    // PREMIUM is retired but still held by existing groups, so it stays in the
    // chart — dropping it would silently under-count the paid base.
    const planBars = (['FREE', 'PRO', 'ORG', 'PREMIUM'] as const)
        .map((t) => ({ label: t === 'PREMIUM' ? 'PREMIUM (legacy)' : t, value: data.planBreakdown[t] ?? 0 }))
        .filter((b) => b.value > 0 || !b.label.includes('legacy'));

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total users" value={data.totalUsers} sub={`${data.suspendedUsers} suspended`} />
                <StatCard label="Active groups" value={data.activeGroups} />
                <StatCard label="MRR" value={fmtINR(data.revenue.mrr)} sub="monthly recurring" />
                <StatCard label="Total Revenue" value={fmtINR(data.revenue.totalRevenue)} sub="all payments" />
            </div>

            <TargetPanel mrr={data.revenue.mrr} payingGroups={data.payingGroups} />

            {/* Buckets groups, not users — plans are held by groups. */}
            <Panel title="Plan breakdown (groups)">
                <Bars data={planBars} />
            </Panel>

            <Panel title="New signups over time">
                <div className="flex gap-1.5 mb-4">
                    {GRANS.map((g) => (
                        <button
                            key={g}
                            onClick={() => setGranularity(g)}
                            className={`px-3 py-1 rounded-lg text-theme-xs font-semibold capitalize ${
                                granularity === g ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300' : 'text-fg-muted hover:text-fg'
                            }`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
                {signupBars.length ? (
                    <Bars data={signupBars} />
                ) : (
                    <p className="text-fg-muted text-xs">No signups in this range.</p>
                )}
            </Panel>
        </div>
    );
}

// The revenue target, made concrete.
//
// MRR as a bare number doesn't tell you what to do on Monday. Expressed as "you
// need N more Organization customers", it does — and N is a number you can put
// against a list of societies to call. The Organization price is the divisor
// because that tier is what the target is actually built on: at ₹999, twenty
// customers clear ₹20,000, which is a sales problem rather than a traffic one.
const TARGET_MRR = 20_000;
const ORG_PRICE = 999;

function TargetPanel({ mrr, payingGroups }: { mrr: number; payingGroups: number }) {
    const pct = Math.min(100, Math.round((mrr / TARGET_MRR) * 100));
    const remaining = Math.max(0, TARGET_MRR - mrr);
    const orgsNeeded = Math.ceil(remaining / ORG_PRICE);

    return (
        <Panel title={`Progress to ${fmtINR(TARGET_MRR)}/month`}>
            <div
                className="h-2.5 w-full rounded-full bg-surface-hover overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${pct}% of the monthly revenue target`}
            >
                <div
                    className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>

            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-theme-sm">
                    <span className="font-semibold">{fmtINR(mrr)}</span>
                    <span className="text-fg-muted"> / {fmtINR(TARGET_MRR)} · {pct}%</span>
                </p>
                <p className="text-theme-xs text-fg-muted">
                    {payingGroups} paying {payingGroups === 1 ? 'group' : 'groups'}
                </p>
            </div>

            <p className="mt-2 text-theme-xs text-fg-muted">
                {remaining === 0
                    ? 'Target met. Raise it.'
                    : `${orgsNeeded} more Organization ${orgsNeeded === 1 ? 'customer' : 'customers'} at ${fmtINR(ORG_PRICE)}/month closes the gap.`}
            </p>
        </Panel>
    );
}
