import { useGetAnalyticsQuery } from '../../redux/api/admin';
import { StatCard, Bars, Panel, fmtINR } from './adminUi';

export default function SubscriptionsSection() {
    const { data, isLoading } = useGetAnalyticsQuery({ granularity: 'month' });

    if (isLoading || !data) {
        return <div className="h-64 rounded-2xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />;
    }

    const planBars = (['FREE', 'PRO', 'PREMIUM'] as const).map((t) => ({ label: t, value: data.planBreakdown[t] }));
    const paying = data.planBreakdown.PRO + data.planBreakdown.PREMIUM;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Free" value={data.planBreakdown.FREE} />
                <StatCard label="Pro" value={data.planBreakdown.PRO} />
                <StatCard label="Premium" value={data.planBreakdown.PREMIUM} />
                <StatCard label="Paying users" value={paying} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <StatCard label="MRR" value={fmtINR(data.revenue.mrr)} sub="monthly recurring revenue" />
                <StatCard label="ARR" value={fmtINR(data.revenue.arr)} sub="annual recurring revenue" />
            </div>

            <Panel title="Users per plan">
                <Bars data={planBars} />
            </Panel>

            <p className="text-[11px] text-white/30">
                To assign a plan to a specific user, open the{' '}
                <span className="text-violet-300">Users</span> tab → <span className="text-violet-300">Manage</span> → Override plan.
            </p>
        </div>
    );
}
