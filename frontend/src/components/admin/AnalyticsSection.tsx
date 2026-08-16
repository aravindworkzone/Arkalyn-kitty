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
    const planBars = (['FREE', 'PRO', 'PREMIUM'] as const).map((t) => ({ label: t, value: data.planBreakdown[t] }));

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total users" value={data.totalUsers} sub={`${data.suspendedUsers} suspended`} />
                <StatCard label="Active groups" value={data.activeGroups} />
                <StatCard label="MRR" value={fmtINR(data.revenue.mrr)} sub="monthly recurring" />
                <StatCard label="Total Revenue" value={fmtINR(data.revenue.totalRevenue)} sub="all payments" />
            </div>

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
