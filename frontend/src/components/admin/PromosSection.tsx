import { useState, useEffect } from 'react';
import {
    useGetPromosQuery,
    useCreatePromoMutation,
    useDeactivatePromoMutation,
    useGetPromoRedemptionsQuery,
} from '../../redux/api/admin';
import type { PlanTier, BillingCycle } from '../../interface/subscription';
import { Panel, TierBadge } from './adminUi';

function RedemptionsModal({ promoId, code, onClose }: { promoId: string; code: string; onClose: () => void }) {
    const { data, isLoading } = useGetPromoRedemptionsQuery(promoId);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return (
        <div className="fixed inset-0 z-modal flex justify-center overflow-y-auto p-4 bg-scrim backdrop-blur-[2px]">
            <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
            <div className="relative my-auto w-full max-w-md rounded-2xl border border-line bg-surface-overlay p-5">
                <h3 className="text-theme-sm font-semibold text-fg mb-3">Redemptions · <span className="font-mono text-brand-600 dark:text-brand-300">{code}</span></h3>
                {isLoading ? (
                    <p className="text-fg-muted text-xs">Loading…</p>
                ) : !data || data.length === 0 ? (
                    <p className="text-fg-muted text-xs">No redemptions yet.</p>
                ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {data.map((r) => {
                            const u = typeof r.userId === 'object' ? r.userId : null;
                            // A code is spent on a group; the user is who redeemed it.
                            const g = r.groupId && typeof r.groupId === 'object' ? r.groupId : null;
                            return (
                                <div key={r._id} className="flex items-center justify-between text-theme-xs border-b border-line pb-2">
                                    <div className="min-w-0">
                                        <p className="text-fg truncate" translate="no">
                                            {g ? `${g.name} · ${g.displayId}` : 'Group'}
                                        </p>
                                        <p className="text-fg-muted text-theme-2xs truncate">
                                            by {u?.name ?? 'user'}{u?.email ? ` · ${u.email}` : ''}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                        <TierBadge tier={r.plan} />
                                        <p className="text-fg-muted text-theme-2xs mt-0.5">{new Date(r.createdAt).toLocaleDateString('en-IN')}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <button onClick={onClose} className="mt-4 w-full rounded-xl border border-line bg-surface-raised py-2 text-sm text-fg hover:bg-surface-hover">
                    Close
                </button>
            </div>
        </div>
    );
}

export default function PromosSection() {
    const { data: promos, isLoading } = useGetPromosQuery();
    const [createPromo, { isLoading: creating }] = useCreatePromoMutation();
    const [deactivate] = useDeactivatePromoMutation();

    const [code, setCode] = useState('');
    const [plan, setPlan] = useState<PlanTier>('PRO');
    const [cycle, setCycle] = useState<BillingCycle>('monthly');
    const [maxUses, setMaxUses] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [viewing, setViewing] = useState<{ id: string; code: string } | null>(null);

    const handleCreate = async () => {
        if (!code.trim()) return;
        setMsg(null);
        try {
            await createPromo({
                code: code.trim().toUpperCase(),
                plan,
                cycle,
                maxRedemptions: maxUses ? Number(maxUses) : null,
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
            }).unwrap();
            setMsg({ ok: true, text: `Created ${code.trim().toUpperCase()}` });
            setCode(''); setMaxUses(''); setExpiresAt('');
        } catch (e: any) {
            setMsg({ ok: false, text: e?.data?.message || 'Could not create promo code.' });
        }
    };

    const inputCls = 'bg-surface-hover border border-line rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-brand-200 dark:border-brand-500/40';

    return (
        <div className="space-y-4">
            <Panel title="Create promo code">
                <div className="grid sm:grid-cols-2 gap-2.5">
                    <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" className={`${inputCls} font-mono tracking-wider`} />
                    <input value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ''))} placeholder="Max uses (blank = unlimited)" inputMode="numeric" className={inputCls} />
                    <select value={plan} onChange={(e) => setPlan(e.target.value as PlanTier)} className={inputCls}>
                        <option value="PRO">Pro</option>
                        <option value="PREMIUM">Premium</option>
                    </select>
                    <select value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)} className={inputCls}>
                        <option value="monthly">Monthly (30 days)</option>
                        <option value="yearly">Yearly (365 days)</option>
                    </select>
                    <label className="text-theme-xs text-fg-muted flex flex-col gap-1">
                        Expires (optional)
                        <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} />
                    </label>
                </div>
                <button onClick={handleCreate} disabled={creating || !code.trim()} className="mt-3 rounded-xl px-5 py-2.5 text-sm font-semibold bg-brand-50 dark:bg-brand-500/80 border border-brand-200 dark:border-brand-500/50 text-fg hover:bg-brand-500 disabled:opacity-50">
                    {creating ? 'Creating…' : 'Create code'}
                </button>
                {msg && <p className={`mt-2 text-xs ${msg.ok ? 'text-success-700 dark:text-success-300' : 'text-error-600 dark:text-error-400'}`}>{msg.text}</p>}
            </Panel>

            <Panel title="Promo codes">
                {isLoading ? (
                    <p className="text-fg-muted text-xs">Loading…</p>
                ) : !promos || promos.length === 0 ? (
                    <p className="text-fg-muted text-xs">No promo codes yet.</p>
                ) : (
                    <div className="space-y-2">
                        {promos.map((p) => (
                            <div key={p._id} className="flex items-center justify-between gap-3 border border-line rounded-xl px-3 py-2.5">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-theme-sm text-fg tracking-wider">{p.code}</span>
                                        <TierBadge tier={p.plan} />
                                        {!p.isActive && <span className="text-theme-2xs px-1.5 py-0.5 rounded bg-surface-hover text-fg-muted">inactive</span>}
                                    </div>
                                    <p className="text-theme-2xs text-fg-muted mt-0.5">
                                        {p.cycle} · {p.redemptionCount}/{p.maxRedemptions ?? '∞'} used
                                        {p.expiresAt && ` · expires ${new Date(p.expiresAt).toLocaleDateString('en-IN')}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => setViewing({ id: p._id, code: p.code })} className="text-theme-xs text-brand-600 dark:text-brand-300 hover:text-brand-600 dark:text-brand-300">
                                        Redemptions
                                    </button>
                                    {p.isActive && (
                                        <button onClick={() => deactivate(p._id)} className="text-theme-xs text-error-600 dark:text-error-400 hover:text-error-600 dark:text-error-400">
                                            Deactivate
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Panel>

            {viewing && <RedemptionsModal promoId={viewing.id} code={viewing.code} onClose={() => setViewing(null)} />}
        </div>
    );
}
