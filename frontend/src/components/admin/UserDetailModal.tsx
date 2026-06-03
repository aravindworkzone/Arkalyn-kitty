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

    const inputCls = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/40';

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
        <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 bg-black/75 backdrop-blur-[2px]">
            <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
            <div className="relative my-auto w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0b0f17] p-5 max-h-[85vh] overflow-y-auto">
                {isLoading || !data ? (
                    <p className="text-white/30 text-sm">Loading…</p>
                ) : (
                    <>
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="text-[15px] font-semibold text-white/90">{data.user.name}</h3>
                                <p className="text-[12px] text-white/40">{data.user.email}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <StatusBadge status={data.user.status} />
                                <TierBadge tier={data.user.subscription.tier} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-white/45 mb-4">
                            <p>Joined: <span className="text-white/70">{new Date(data.user.createdAt).toLocaleDateString('en-IN')}</span></p>
                            <p>Source: <span className="text-white/70">{data.user.planSource ?? '—'}</span></p>
                            <p>Status: <span className="text-white/70">{data.user.subscription.status}</span></p>
                            <p>Expires: <span className="text-white/70">{data.user.planExpiresAt ? new Date(data.user.planExpiresAt).toLocaleDateString('en-IN') : '—'}</span></p>
                            <p className="col-span-2">Last login: <span className="text-white/70">
                                {data.user.lastLoginAt
                                    ? new Date(data.user.lastLoginAt).toLocaleString('en-IN', {
                                          day: '2-digit', month: 'short', year: 'numeric',
                                          hour: '2-digit', minute: '2-digit', hour12: true,
                                      })
                                    : '—'}
                            </span></p>
                        </div>

                        <p className="text-[11px] uppercase tracking-widest text-white/30 mb-2">Groups ({data.groups.length})</p>
                        <div className="space-y-1.5 mb-5 max-h-40 overflow-y-auto">
                            {data.groups.length === 0 ? (
                                <p className="text-white/30 text-xs">No groups.</p>
                            ) : (
                                data.groups.map((g) => (
                                    <div key={g._id} className="flex items-center justify-between gap-2 text-[12px] border-b border-white/[0.05] pb-1.5">
                                        <div className="min-w-0">
                                            <p className="text-white/70 truncate">{g.name}</p>
                                            <p className="text-white/25 text-[10px]">
                                                Last action:{' '}
                                                {g.lastActionAt
                                                    ? new Date(g.lastActionAt).toLocaleString('en-GB', {
                                                          day: '2-digit', month: 'short', year: 'numeric',
                                                          hour: '2-digit', minute: '2-digit', hour12: false,
                                                      })
                                                    : 'No activity'}
                                            </p>
                                        </div>
                                        <span className="text-white/30 text-[10px] shrink-0">{g.role} · {g.status}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                            <p className="text-[12px] font-semibold text-white/75 mb-2.5">Override plan</p>
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
                                    <label className="col-span-2 text-[11px] text-white/40 flex flex-col gap-1">
                                        Expires (optional — defaults to cycle length)
                                        <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} />
                                    </label>
                                )}
                            </div>
                            <button onClick={handleApply} disabled={saving} className="mt-3 w-full rounded-xl py-2 text-sm font-semibold bg-violet-500/80 border border-violet-500/50 text-white hover:bg-violet-500 disabled:opacity-50">
                                {saving ? 'Applying…' : 'Apply override'}
                            </button>
                            {msg && <p className="mt-2 text-xs text-white/50">{msg}</p>}
                        </div>

                        <button onClick={onClose} className="mt-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-sm text-white/60 hover:bg-white/[0.06]">
                            Close
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
