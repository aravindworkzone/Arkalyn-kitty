import { useState, useEffect } from 'react';
import { useGetAdminUserDetailQuery, useOverrideUserPlanMutation } from '../../redux/api/admin';
import type { PlanTier, BillingCycle } from '../../interface/subscription';
import { TierBadge, StatusBadge } from './adminUi';

export default function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
    const { data, isLoading } = useGetAdminUserDetailQuery(userId);
    const [overridePlan, { isLoading: saving }] = useOverrideUserPlanMutation();

    const [plan, setPlan] = useState<PlanTier>('PRO');
    const [cycle, setCycle] = useState<BillingCycle>('monthly');
    const [expiresAt, setExpiresAt] = useState('');
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const inputCls = 'bg-surface-hover border border-line rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-brand-200 dark:border-brand-500/40';

    const handleApply = async () => {
        setMsg(null);
        try {
            await overridePlan({
                userId,
                plan,
                ...(plan !== 'FREE' ? { cycle, ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}) } : {}),
            }).unwrap();
            setMsg('Plan updated.');
        } catch (e: any) {
            setMsg(e?.data?.message || 'Could not update plan.');
        }
    };

    return (
        <div className="fixed inset-0 z-modal flex justify-center overflow-y-auto p-4 bg-scrim backdrop-blur-[2px]">
            <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
            <div className="relative my-auto w-full max-w-lg rounded-2xl border border-line bg-surface-overlay p-5 max-h-[85vh] overflow-y-auto">
                {isLoading || !data ? (
                    <p className="text-fg-muted text-sm">Loading…</p>
                ) : (
                    <>
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="text-theme-sm font-semibold text-fg">{data.user.name}</h3>
                                <p className="text-theme-xs text-fg-muted">{data.user.email}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <StatusBadge status={data.user.status} />
                                <TierBadge tier={data.user.subscription.tier} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-theme-xs text-fg-muted mb-4">
                            <p>Joined: <span className="text-fg">{new Date(data.user.createdAt).toLocaleDateString('en-IN')}</span></p>
                            <p>Source: <span className="text-fg">{data.user.planSource ?? '—'}</span></p>
                            <p>Status: <span className="text-fg">{data.user.subscription.status}</span></p>
                            <p>Expires: <span className="text-fg">{data.user.planExpiresAt ? new Date(data.user.planExpiresAt).toLocaleDateString('en-IN') : '—'}</span></p>
                            <p className="col-span-2">Last login: <span className="text-fg">
                                {data.user.lastLoginAt
                                    ? new Date(data.user.lastLoginAt).toLocaleString('en-IN', {
                                          day: '2-digit', month: 'short', year: 'numeric',
                                          hour: '2-digit', minute: '2-digit', hour12: true,
                                      })
                                    : '—'}
                            </span></p>
                        </div>

                        <p className="text-theme-xs uppercase tracking-widest text-fg-muted mb-2">Groups ({data.groups.length})</p>
                        <div className="space-y-1.5 mb-5 max-h-40 overflow-y-auto">
                            {data.groups.length === 0 ? (
                                <p className="text-fg-muted text-xs">No groups.</p>
                            ) : (
                                data.groups.map((g) => (
                                    <div key={g._id} className="flex items-center justify-between gap-2 text-theme-xs border-b border-line pb-1.5">
                                        <div className="min-w-0">
                                            <p className="text-fg truncate">{g.name}</p>
                                            <p className="text-fg-muted text-theme-2xs">
                                                Last action:{' '}
                                                {g.lastActionAt
                                                    ? new Date(g.lastActionAt).toLocaleString('en-GB', {
                                                          day: '2-digit', month: 'short', year: 'numeric',
                                                          hour: '2-digit', minute: '2-digit', hour12: false,
                                                      })
                                                    : 'No activity'}
                                            </p>
                                        </div>
                                        <span className="text-fg-muted text-theme-2xs shrink-0">{g.role} · {g.status}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="rounded-xl border border-line bg-surface-raised p-3.5">
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
                                        <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} />
                                    </label>
                                )}
                            </div>
                            <button onClick={handleApply} disabled={saving} className="mt-3 w-full rounded-xl py-2 text-sm font-semibold bg-brand-50 dark:bg-brand-500/80 border border-brand-200 dark:border-brand-500/50 text-fg hover:bg-brand-500 disabled:opacity-50">
                                {saving ? 'Applying…' : 'Apply override'}
                            </button>
                            {msg && <p className="mt-2 text-xs text-fg-muted">{msg}</p>}
                        </div>

                        <button onClick={onClose} className="mt-4 w-full rounded-xl border border-line bg-surface-raised py-2 text-sm text-fg hover:bg-surface-hover">
                            Close
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
