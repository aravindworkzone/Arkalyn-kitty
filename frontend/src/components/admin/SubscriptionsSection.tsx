import { useGetAnalyticsQuery } from '../../redux/api/admin';
import { StatCard, Bars, Panel, fmtINR } from './adminUi';

export default function SubscriptionsSection() {
    const { data, isLoading } = useGetAnalyticsQuery({ granularity: 'month' });

    if (isLoading || !data) {
        return <div className="h-64 rounded-2xl bg-surface-raised border border-line animate-pulse" />;
    }

    const planBars = (['FREE', 'PRO', 'PREMIUM'] as const).map((t) => ({ label: t, value: data.planBreakdown[t] }));
    const upgraded = data.planBreakdown.PRO + data.planBreakdown.PREMIUM;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Free" value={data.planBreakdown.FREE} />
                <StatCard label="Pro" value={data.planBreakdown.PRO} />
                <StatCard label="Premium" value={data.planBreakdown.PREMIUM} />
                <StatCard label="Upgraded users" value={upgraded} sub="incl. promo &amp; admin" />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
                <StatCard label="Paying users" value={data.payingUsers} sub="payment only" />
                <StatCard label="MRR" value={fmtINR(data.revenue.mrr)} sub="monthly recurring revenue" />
                <StatCard label="Total Revenue" value={fmtINR(data.revenue.totalRevenue)} sub="all payments collected" />
            </div>

            <Panel title="Users per plan">
                <Bars data={planBars} />
            </Panel>

            <p className="text-theme-xs text-fg-muted">
                To assign a plan to a specific user, open the{' '}
                <span className="text-brand-600 dark:text-brand-300">Users</span> tab → <span className="text-brand-600 dark:text-brand-300">Manage</span> → Override plan.
            </p>
        </div>
    );
}
