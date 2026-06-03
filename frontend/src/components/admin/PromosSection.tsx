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
        <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 bg-black/75 backdrop-blur-[2px]">
            <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
            <div className="relative my-auto w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0b0f17] p-5">
                <h3 className="text-[14px] font-semibold text-white/85 mb-3">Redemptions · <span className="font-mono text-violet-300">{code}</span></h3>
                {isLoading ? (
                    <p className="text-white/30 text-xs">Loading…</p>
                ) : !data || data.length === 0 ? (
                    <p className="text-white/30 text-xs">No redemptions yet.</p>
                ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {data.map((r) => {
                            const u = typeof r.userId === 'object' ? r.userId : null;
                            return (
                                <div key={r._id} className="flex items-center justify-between text-[12px] border-b border-white/[0.05] pb-2">
                                    <div className="min-w-0">
                                        <p className="text-white/75 truncate">{u?.name ?? 'User'}</p>
                                        <p className="text-white/30 text-[10px] truncate">{u?.email ?? String(r.userId)}</p>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                        <TierBadge tier={r.plan} />
                                        <p className="text-white/30 text-[10px] mt-0.5">{new Date(r.createdAt).toLocaleDateString('en-IN')}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <button onClick={onClose} className="mt-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-sm text-white/60 hover:bg-white/[0.06]">
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

    const inputCls = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/40';

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
                    <label className="text-[11px] text-white/40 flex flex-col gap-1">
                        Expires (optional)
                        <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} />
                    </label>
                </div>
                <button onClick={handleCreate} disabled={creating || !code.trim()} className="mt-3 rounded-xl px-5 py-2.5 text-sm font-semibold bg-violet-500/80 border border-violet-500/50 text-white hover:bg-violet-500 disabled:opacity-50">
                    {creating ? 'Creating…' : 'Create code'}
                </button>
                {msg && <p className={`mt-2 text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
            </Panel>

            <Panel title="Promo codes">
                {isLoading ? (
                    <p className="text-white/30 text-xs">Loading…</p>
                ) : !promos || promos.length === 0 ? (
                    <p className="text-white/30 text-xs">No promo codes yet.</p>
                ) : (
                    <div className="space-y-2">
                        {promos.map((p) => (
                            <div key={p._id} className="flex items-center justify-between gap-3 border border-white/[0.06] rounded-xl px-3 py-2.5">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[13px] text-white/85 tracking-wider">{p.code}</span>
                                        <TierBadge tier={p.plan} />
                                        {!p.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/35">inactive</span>}
                                    </div>
                                    <p className="text-[10px] text-white/30 mt-0.5">
                                        {p.cycle} · {p.redemptionCount}/{p.maxRedemptions ?? '∞'} used
                                        {p.expiresAt && ` · expires ${new Date(p.expiresAt).toLocaleDateString('en-IN')}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => setViewing({ id: p._id, code: p.code })} className="text-[11px] text-violet-300 hover:text-violet-200">
                                        Redemptions
                                    </button>
                                    {p.isActive && (
                                        <button onClick={() => deactivate(p._id)} className="text-[11px] text-red-300/80 hover:text-red-300">
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
