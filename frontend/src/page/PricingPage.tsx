import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/header';
import { PageBackground } from '../components/ui';
import { useGetUserQuery } from '../redux/api/auth';
import {
    useGetPlansQuery,
    useCreateSubscriptionOrderMutation,
    useVerifySubscriptionPaymentMutation,
    useRedeemPromoCodeMutation,
} from '../redux/api/subscription';
import { usePlan } from '../hooks/usePlan';
import { loadRazorpay, openRazorpayCheckout } from '../utils/loadRazorpay';
import type { PlanTier, BillingCycle, PlanConfig } from '../interface/subscription';

const TIER_ORDER: PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];

// Featured promo advertised on the pricing page — grants 3 months of Premium.
// The code must also exist in the DB (created via the admin dashboard) to redeem.
const FEATURED_PROMO = 'ARKALYN-KITTY-3M-PREMIUM';

const fmtLimit = (n: number | null) => (n === null ? 'Unlimited' : String(n));
const fmtDays = (n: number | null) => (n === null ? 'Unlimited' : `${n} days`);

// Per-tier visual accent + icon.
const TIER_THEME: Record<PlanTier, { ring: string; chip: string; cta: string; glow: string; icon: ReactNode }> = {
    FREE: {
        ring: 'border-white/[0.08]',
        chip: 'bg-white/[0.06] text-white/50',
        cta: 'bg-white/[0.04] border border-white/[0.08] text-white/40 cursor-default',
        glow: 'from-transparent via-white/15 to-transparent',
        icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
        ),
    },
    PRO: {
        ring: 'border-violet-500/40 ring-1 ring-violet-500/30',
        chip: 'bg-violet-500/15 text-violet-300',
        cta: 'bg-violet-500/85 border border-violet-500/50 text-white hover:bg-violet-500 active:bg-violet-600 shadow-lg shadow-violet-900/30',
        glow: 'from-transparent via-violet-500/50 to-transparent',
        icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2.5 11.5L4 5l3 3 1-5 1 5 3-3 1.5 6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
        ),
    },
    PREMIUM: {
        ring: 'border-amber-400/30',
        chip: 'bg-amber-400/15 text-amber-300',
        cta: 'bg-gradient-to-r from-amber-400/90 to-orange-500/90 border border-amber-400/40 text-[#1a1206] font-bold hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-amber-900/20',
        glow: 'from-transparent via-amber-400/50 to-transparent',
        icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 5l2.5 2L8 3l2.5 4L13 5l-1 7H4L3 5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
        ),
    },
};

// The headline feature lines shown on each tier card.
const featureLines = (tier: PlanTier, cfg: PlanConfig): string[] => {
    const l = cfg.limits;
    const lines = [
        `${fmtLimit(l.maxGroups)} active groups`,
        `${fmtLimit(l.maxMembersPerGroup)} members per group`,
        `${fmtLimit(l.maxCategoriesPerGroup)} categories per group`,
        `${fmtDays(l.transactionLogRetentionDays)} transaction history`,
        `${fmtDays(l.eventLogRetentionDays)} activity history`,
        cfg.features.advancedReportRange ? 'All-time & custom reports' : 'This & last month reports',
    ];
    if (cfg.features.cloneGroup) lines.push('Clone groups in one click');
    if (tier === 'PREMIUM') lines.push('Everything unlimited');
    return lines;
};

export default function PricingPage() {
    const navigate = useNavigate();
    const { data: plansData, isLoading: plansLoading } = useGetPlansQuery();
    const { data: userData } = useGetUserQuery();
    const { tier: currentTier, status, plan } = usePlan();

    const [createOrder] = useCreateSubscriptionOrderMutation();
    const [verifyPayment] = useVerifySubscriptionPaymentMutation();
    const [redeemPromo] = useRedeemPromoCodeMutation();

    const [cycle, setCycle] = useState<BillingCycle>('monthly');
    const [processing, setProcessing] = useState<PlanTier | null>(null);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const [promoCode, setPromoCode] = useState('');
    const [redeeming, setRedeeming] = useState(false);

    const handleRedeem = async () => {
        const code = promoCode.trim();
        if (!code) return;
        setMsg(null);
        setRedeeming(true);
        try {
            const granted = await redeemPromo({ code }).unwrap();
            setMsg({ ok: true, text: `Promo applied — you're now on ${granted.tier}!` });
            setPromoCode('');
        } catch (e: any) {
            setMsg({ ok: false, text: e?.data?.message || 'Could not apply that promo code.' });
        } finally {
            setRedeeming(false);
        }
    };

    const user = userData?.data?.user;

    const handleUpgrade = async (tier: PlanTier) => {
        if (tier === 'FREE') return;
        setMsg(null);
        setProcessing(tier);
        try {
            const order = await createOrder({ plan: tier, cycle }).unwrap();

            const ready = await loadRazorpay();
            if (!ready) {
                setMsg({ ok: false, text: 'Could not load the payment window. Check your connection and retry.' });
                setProcessing(null);
                return;
            }

            const opened = openRazorpayCheckout({
                key: order.keyId,
                amount: order.amount,
                currency: order.currency,
                name: 'Arkalyn — Kitty',
                description: `${tier} plan (${cycle})`,
                order_id: order.orderId,
                prefill: { name: user?.name, email: user?.email },
                theme: { color: '#7c3aed' },
                handler: async (res) => {
                    try {
                        await verifyPayment({
                            razorpay_order_id: res.razorpay_order_id,
                            razorpay_payment_id: res.razorpay_payment_id,
                            razorpay_signature: res.razorpay_signature,
                        }).unwrap();
                        setMsg({ ok: true, text: `You're now on ${tier}. Enjoy your new features!` });
                    } catch {
                        setMsg({ ok: false, text: 'Payment captured but verification failed. Refresh in a moment — it may already be active.' });
                    } finally {
                        setProcessing(null);
                    }
                },
                modal: { ondismiss: () => setProcessing(null) },
            });

            if (!opened) {
                setMsg({ ok: false, text: 'Could not open the payment window.' });
                setProcessing(null);
            }
        } catch (e: any) {
            setMsg({ ok: false, text: e?.data?.message || 'Could not start the payment. Try again.' });
            setProcessing(null);
        }
    };

    const expiryLabel =
        plan.planExpiresAt && currentTier !== 'FREE'
            ? new Date(plan.planExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : null;

    return (
        <div className="min-h-screen bg-[#080c14] text-white">
            <PageBackground />
            <Header />

            <main className="max-w-5xl mx-auto px-4 pt-10 pb-28">
                {/* Hero */}
                <div className="text-center max-w-xl mx-auto mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/25 bg-violet-500/10 mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300/80">Plans & Billing</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f0eeff]">
                        Do more with your groups
                    </h1>
                    <p className="text-white/45 text-sm mt-3 leading-relaxed">
                        Start free, upgrade when you grow. One-time payment unlocks access for the full billing period —
                        no auto-renewal surprises.
                    </p>

                    <div className="mt-4 inline-flex items-center gap-2 text-[12px] text-white/40">
                        <span>Current plan:</span>
                        <span className={`px-2 py-0.5 rounded-md font-semibold ${TIER_THEME[currentTier].chip}`} translate="no">
                            {currentTier}
                        </span>
                        {status === 'grace' && <span className="text-amber-300/80">· grace period</span>}
                        {status === 'expired' && <span className="text-red-300/80">· expired</span>}
                        {expiryLabel && status !== 'expired' && <span>· renews/expires {expiryLabel}</span>}
                    </div>
                </div>

                {/* promo code — directly below the current plan */}
                <div className="mb-8 max-w-md mx-auto rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-violet-300" viewBox="0 0 16 16" fill="none">
                            <path d="M2 6.5l5-4 7 3-1 7-7 1-4-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                            <circle cx="6" cy="6" r="1" fill="currentColor" />
                        </svg>
                        <h3 className="text-[13px] font-semibold text-white/80">Have a promo code?</h3>
                    </div>
                    <p className="text-[11px] text-white/35 mb-3">
                        Enter it to unlock your plan instantly — no payment needed.
                    </p>

                    {/* Featured offer — tap to fill the field. */}
                    <button
                        type="button"
                        onClick={() => setPromoCode(FEATURED_PROMO)}
                        className="w-full mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-2.5 text-left hover:border-amber-400/40 hover:bg-amber-400/[0.1] transition-colors"
                    >
                        <div className="min-w-0">
                            <p className="font-mono text-[12px] tracking-wider text-amber-200 truncate">{FEATURED_PROMO}</p>
                            <p className="text-[10px] text-amber-200/50 mt-0.5">Free Premium trial valid until August 1, 2026</p>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-200/80 shrink-0">Tap to use</span>
                    </button>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem(); }}
                            placeholder="PROMO CODE"
                            autoComplete="off"
                            spellCheck={false}
                            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm font-mono tracking-wider text-white placeholder-white/20 outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/10 transition-all"
                        />
                        <button
                            onClick={handleRedeem}
                            disabled={redeeming || !promoCode.trim()}
                            className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-violet-500/80 border border-violet-500/50 text-white hover:bg-violet-500 active:bg-violet-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {redeeming ? 'Applying…' : 'Apply'}
                        </button>
                    </div>
                </div>

                {/* Billing cycle toggle */}
                <div className="flex justify-center mb-8">
                    <div className="inline-flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-1.5">
                        {(['monthly', 'yearly'] as BillingCycle[]).map((c) => (
                            <button
                                key={c}
                                onClick={() => setCycle(c)}
                                className={`relative px-5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
                                    cycle === c ? 'bg-violet-500/20 text-violet-100 shadow-sm' : 'text-white/45 hover:text-white/75'
                                }`}
                            >
                                {c === 'monthly' ? 'Monthly' : 'Yearly'}
                                {c === 'yearly' && (
                                    <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 align-middle">
                                        SAVE 20%
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {msg && (
                    <div
                        className={`max-w-md mx-auto mb-8 rounded-xl px-4 py-3 text-sm border text-center ${
                            msg.ok
                                ? 'bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/[0.06] border-red-500/15 text-red-300'
                        }`}
                    >
                        {msg.text}
                    </div>
                )}

                {/* Tier cards */}
                {plansLoading || !plansData ? (
                    <div className="grid sm:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-[520px] rounded-3xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-3 gap-4 items-start">
                        {TIER_ORDER.map((tier) => {
                            const cfg = plansData[tier];
                            const theme = TIER_THEME[tier];
                            const isCurrent = tier === currentTier;
                            const isPopular = tier === 'PRO';
                            const price = cycle === 'yearly' ? cfg.priceYearly : cfg.priceMonthly;
                            const perMonth = cycle === 'yearly' && price > 0 ? Math.round(price / 12) : null;

                            return (
                                <div
                                    key={tier}
                                    className={`relative rounded-3xl border p-6 flex flex-col bg-white/[0.03] transition-transform duration-200 ${theme.ring} ${
                                        isPopular ? 'sm:-translate-y-3' : ''
                                    }`}
                                >
                                    {/* top accent line */}
                                    <div className={`absolute top-0 left-8 right-8 h-px bg-gradient-to-r ${theme.glow}`} />

                                    {isPopular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-violet-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-violet-900/40">
                                            Most popular
                                        </div>
                                    )}

                                    {/* header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${theme.chip}`}>
                                                {theme.icon}
                                            </span>
                                            <h2 className="text-[17px] font-semibold text-[#f0eeff]">{cfg.name}</h2>
                                        </div>
                                        {isCurrent && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-white/15 bg-white/[0.06] text-white/60">
                                                Current
                                            </span>
                                        )}
                                    </div>

                                    {/* price */}
                                    <div className="mt-5 mb-1">
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-4xl font-bold text-white tracking-tight" translate="no">
                                                ₹{price}
                                            </span>
                                            {tier !== 'FREE' && (
                                                <span className="text-sm text-white/40">{cycle === 'yearly' ? '/year' : '/month'}</span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-white/35 mt-1 h-4" translate="no">
                                            {tier === 'FREE'
                                                ? 'Free forever'
                                                : perMonth !== null
                                                ? `≈ ₹${perMonth}/mo · billed once a year`
                                                : 'Billed once a month'}
                                        </p>
                                    </div>

                                    <div className="my-5 h-px bg-white/[0.06]" />

                                    {/* features */}
                                    <ul className="space-y-2.5 flex-1">
                                        {featureLines(tier, cfg).map((line) => (
                                            <li key={line} className="flex items-start gap-2.5 text-[12.5px] text-white/60 leading-snug">
                                                <svg className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400/80" viewBox="0 0 16 16" fill="none">
                                                    <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.12" />
                                                    <path d="M5 8.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {line}
                                            </li>
                                        ))}
                                    </ul>

                                    {/* CTA */}
                                    <button
                                        disabled={tier === 'FREE' || isCurrent || processing !== null}
                                        onClick={() => handleUpgrade(tier)}
                                        className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed ${
                                            tier === 'FREE' || isCurrent ? theme.cta : `${theme.cta} disabled:opacity-60`
                                        }`}
                                    >
                                        {processing === tier
                                            ? 'Processing…'
                                            : isCurrent
                                            ? 'Your current plan'
                                            : tier === 'FREE'
                                            ? 'Included'
                                            : `Upgrade to ${cfg.name}`}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* trust footer */}
                <div className="mt-8 flex flex-col items-center gap-3 text-center">
                    <div className="flex items-center gap-2 text-[11px] text-white/30">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                            <rect x="2.5" y="6" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
                            <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.1" />
                        </svg>
                        Secured by Razorpay · Cards, UPI & Net Banking
                    </div>
                    <button onClick={() => navigate('/groups')} className="text-violet-400 text-xs hover:text-violet-300 transition-colors">
                        ← Back to groups
                    </button>
                </div>
            </main>
        </div>
    );
}
