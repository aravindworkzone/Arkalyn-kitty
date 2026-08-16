import { useState } from 'react';
import {
    useGetAnalyticsQuery,
    useGetAdminSubscriptionsQuery,
    useOverrideGroupPlanMutation,
} from '../../redux/api/admin';
import { StatCard, Bars, Panel, fmtINR, TierBadge } from './adminUi';
import { getApiErrorMessage } from '../../hooks/useApiError';
import type { AdminGroupSubscriptionRow } from '../../interface/admin';
import type { PlanTier, BillingCycle } from '../../interface/subscription';

const LIMIT = 20;
const selectClass =
    'bg-surface-hover border border-line rounded-xl px-3 py-2.5 text-sm text-fg outline-none focus:border-brand-200 dark:border-brand-500/40 [&>option]:bg-surface-overlay';
const inputCls =
    'bg-surface-hover border border-line rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-brand-200 dark:border-brand-500/40';

const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Inline override for one group's plan. Comps and corrections only — a real
// purchase goes through Razorpay and lands with planSource PAYMENT.
function OverrideRow({ group, onDone }: { group: AdminGroupSubscriptionRow; onDone: () => void }) {
    const [overrideGroupPlan, { isLoading: saving }] = useOverrideGroupPlanMutation();
    const [plan, setPlan] = useState<PlanTier>(group.plan === 'FREE' ? 'PRO' : group.plan);
    const [cycle, setCycle] = useState<BillingCycle>(group.planCycle ?? 'monthly');
    const [expiresAt, setExpiresAt] = useState('');
    const [msg, setMsg] = useState<string | null>(null);

    const apply = async () => {
        setMsg(null);
        try {
            await overrideGroupPlan({
                groupId: group._id,
                plan,
                ...(plan !== 'FREE'
                    ? { cycle, ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}) }
                    : {}),
            }).unwrap();
            setMsg('Plan updated.');
            onDone();
        } catch (e) {
            setMsg(getApiErrorMessage(e, 'Could not update plan.'));
        }
    };

    return (
        <div className="mt-3 rounded-xl border border-line bg-surface-raised p-3.5">
            <p className="text-theme-xs font-semibold text-fg mb-2.5">Override plan</p>
            <div className="grid grid-cols-2 gap-2">
                <select value={plan} onChange={(e) => setPlan(e.target.value as PlanTier)} className={inputCls}>
                    <option value="FREE">Free</option>
                    <option value="PRO">Pro</option>
                    <option value="PREMIUM">Premium</option>
                </select>
                {plan !== 'FREE' && (
                    <select value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)} className={inputCls}>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                )}
                {plan !== 'FREE' && (
                    <label className="col-span-2 text-theme-xs text-fg-muted flex flex-col gap-1">
                        Expires (optional — defaults to cycle length)
                        <input
                            type="datetime-local"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            className={inputCls}
                        />
                    </label>
                )}
            </div>
            <button
                onClick={apply}
                disabled={saving}
                className="mt-3 w-full rounded-xl py-2 text-sm font-semibold bg-brand-50 dark:bg-brand-500/80 border border-brand-200 dark:border-brand-500/50 text-fg hover:bg-brand-500 disabled:opacity-50"
            >
                {saving ? 'Applying…' : 'Apply override'}
            </button>
            {msg && <p className="mt-2 text-xs text-fg-muted">{msg}</p>}
        </div>
    );
}

export default function SubscriptionsSection() {
    const { data: analytics, isLoading: analyticsLoading } = useGetAnalyticsQuery({ granularity: 'month' });

    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState<PlanTier | ''>('');
    const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
    const [expanded, setExpanded] = useState<string | null>(null);

    const { data: list, isLoading: listLoading } = useGetAdminSubscriptionsQuery({
        page,
        limit: LIMIT,
        search: search || undefined,
        plan: planFilter || undefined,
        sort,
    });

    const submitSearch = () => { setPage(1); setSearch(searchInput.trim()); };

    if (analyticsLoading || !analytics) {
        return <div className="h-64 rounded-2xl bg-surface-raised border border-line animate-pulse" />;
    }

    const planBars = (['FREE', 'PRO', 'PREMIUM'] as const).map((t) => ({
        label: t,
        value: analytics.planBreakdown[t],
    }));
    const upgraded = analytics.planBreakdown.PRO + analytics.planBreakdown.PREMIUM;

    const items = list?.items ?? [];
    const total = list?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / LIMIT));

    return (
        <div className="space-y-4">
            {/* Every count here is per GROUP — the unit that holds a plan. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Free groups" value={analytics.planBreakdown.FREE} />
                <StatCard label="Pro groups" value={analytics.planBreakdown.PRO} />
                <StatCard label="Premium groups" value={analytics.planBreakdown.PREMIUM} />
                <StatCard label="Upgraded groups" value={upgraded} sub="incl. promo &amp; admin" />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
                <StatCard label="Paying groups" value={analytics.payingGroups} sub="payment only" />
                <StatCard label="MRR" value={fmtINR(analytics.revenue.mrr)} sub="monthly recurring revenue" />
                <StatCard label="Total Revenue" value={fmtINR(analytics.revenue.totalRevenue)} sub="all payments collected" />
            </div>

            <Panel title="Groups per plan">
                <Bars data={planBars} />
            </Panel>

            <div className="flex flex-wrap gap-2">
                <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                    placeholder="Search by group name or ID…"
                    className="flex-1 min-w-[180px] bg-surface-hover border border-line rounded-xl px-4 py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-brand-200 dark:border-brand-500/40"
                />
                <button
                    onClick={submitSearch}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-brand-50 dark:bg-brand-500/80 border border-brand-200 dark:border-brand-500/50 text-fg hover:bg-brand-500"
                >
                    Search
                </button>
                <select
                    value={planFilter}
                    onChange={(e) => { setPage(1); setPlanFilter(e.target.value as PlanTier | ''); }}
                    className={selectClass}
                    aria-label="Filter by plan"
                >
                    <option value="">All plans</option>
                    <option value="FREE">Free</option>
                    <option value="PRO">Pro</option>
                    <option value="PREMIUM">Premium</option>
                </select>
                <select
                    value={sort}
                    onChange={(e) => { setPage(1); setSort(e.target.value as 'newest' | 'oldest'); }}
                    className={selectClass}
                    aria-label="Sort order"
                >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                </select>
            </div>

            <div className="rounded-2xl border border-line bg-surface-raised overflow-hidden">
                {listLoading ? (
                    <div className="p-6 text-fg-muted text-sm">Loading…</div>
                ) : items.length === 0 ? (
                    <div className="p-6 text-fg-muted text-sm">No groups found.</div>
                ) : (
                    items.map((g) => (
                        <div key={g._id} className="border-b border-line last:border-0 px-4 py-3">
                            <div
                                onClick={() => setExpanded((cur) => (cur === g._id ? null : g._id))}
                                className="flex items-center gap-3 cursor-pointer"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-theme-sm text-fg truncate" translate="no">{g.name}</p>
                                    <p className="text-theme-xs text-fg-muted truncate" translate="no">
                                        {g.displayId} · {g.status}
                                    </p>
                                    <p className="text-theme-2xs text-fg-muted mt-0.5">
                                        {g.planSource ?? 'no plan'} · {g.planStatus} · expires {fmtDate(g.planExpiresAt)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <TierBadge tier={g.effectiveTier} />
                                </div>
                            </div>

                            {/* A closed group's plan is frozen, so it offers no override. */}
                            {expanded === g._id &&
                                (g.status === 'CLOSED' ? (
                                    <p className="mt-3 text-theme-xs text-fg-muted">
                                        This group is closed — its plan is frozen and can't be changed.
                                    </p>
                                ) : (
                                    <OverrideRow group={g} onDone={() => setExpanded(null)} />
                                ))}
                        </div>
                    ))
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between text-theme-xs text-fg-muted">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40 hover:bg-surface-hover"
                    >
                        Previous
                    </button>
                    <span>Page {page} of {totalPages}</span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40 hover:bg-surface-hover"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
