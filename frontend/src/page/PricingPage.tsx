import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/header';
import { PageBackground } from '../components/ui';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
    useGetPlansQuery,
    useCreateSubscriptionOrderMutation,
    useVerifySubscriptionPaymentMutation,
    useMarkSubscriptionPaymentFailedMutation,
    useRedeemPromoCodeMutation,
} from '../redux/api/subscription';
import { usePlan } from '../hooks/usePlan';
import { PLAN_RANK } from '../helpers/plans';
import { loadRazorpay, openRazorpayCheckout } from '../utils/loadRazorpay';
import type { PlanTier, BillingCycle, PlanConfig } from '../interface/subscription';

const TIER_ORDER: PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];

// Featured promo advertised on the pricing page — grants 3 months of Premium.
// The code must also exist in the DB (created via the admin dashboard) to redeem.
const FEATURED_PROMO = 'ARKALYN-KITTY-3M-PREMIUM-Y-INIT';

const fmtLimit = (n: number | null) => (n === null ? 'Unlimited' : String(n));
const fmtDays = (n: number | null) => (n === null ? 'Unlimited' : `${n} days`);

// Per-tier visual accent + icon.
const TIER_THEME: Record<PlanTier, { ring: string; chip: string; cta: string; glow: string; icon: ReactNode }> = {
    FREE: {
        ring: 'border-line',
        chip: 'bg-surface-hover text-fg-muted',
        cta: 'bg-surface-hover border border-line text-fg-muted cursor-default',
        glow: 'from-transparent via-line-strong to-transparent',
        icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
        ),
    },
    PRO: {
        ring: 'border-brand-500/40 ring-1 ring-brand-500/30',
        chip: 'bg-brand-500/15 text-brand-300',
        cta: 'bg-brand-500/85 border border-brand-500/50 text-on-accent hover:bg-brand-500 active:bg-brand-600 shadow-lg shadow-brand-900/30',
        glow: 'from-transparent via-brand-500/50 to-transparent',
        icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2.5 11.5L4 5l3 3 1-5 1 5 3-3 1.5 6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
        ),
    },
    PREMIUM: {
        ring: 'border-warning-400/30',
        chip: 'bg-warning-400/15 text-warning-300',
        cta: 'bg-gradient-to-r from-warning-400/90 to-warning-500/90 border border-warning-400/40 text-[#1a1206] font-bold hover:from-warning-400 hover:to-warning-500 shadow-lg shadow-warning-900/20',
        glow: 'from-transparent via-warning-400/50 to-transparent',
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
    const { user } = useCurrentUser();
    const { tier: currentTier, status, plan } = usePlan();

    const [createOrder] = useCreateSubscriptionOrderMutation();
    const [verifyPayment] = useVerifySubscriptionPaymentMutation();
    const [markPaymentFailed] = useMarkSubscriptionPaymentFailedMutation();
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

            // `settled` guards the dismiss path: once a success/failure fired we
            // must not also record the attempt as an abandonment.
            const settled = { current: false };
            const orderId = order.orderId;

            const opened = openRazorpayCheckout(
                {
                    key: order.keyId,
                    amount: order.amount,
                    currency: order.currency,
                    name: 'Arkalyn — Kitty',
                    description: `${tier} plan (${cycle})`,
                    order_id: order.orderId,
                    prefill: { name: user?.name, email: user?.email },
                    theme: { color: '#7c3aed' },
                    handler: async (res) => {
                        settled.current = true;
                        try {
                            await verifyPayment({
                                razorpay_order_id: res.razorpay_order_id,
                                razorpay_payment_id: res.razorpay_payment_id,
                                razorpay_signature: res.razorpay_signature,
                            }).unwrap();
                            setMsg({ ok: true, text: `You're now on ${tier}. Enjoy your new features!` });
                        } catch {
                            // Don't mark failed — Razorpay may have captured it; the
                            // webhook is the source of truth.
                            setMsg({ ok: false, text: 'Payment captured but verification failed. Refresh in a moment — it may already be active.' });
                        } finally {
                            setProcessing(null);
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            if (!settled.current) {
                                settled.current = true;
                                markPaymentFailed({ razorpay_order_id: orderId });
                                setMsg({ ok: false, text: 'Payment cancelled. You can try again anytime.' });
                            }
                            setProcessing(null);
                        },
                    },
                },
                (resp) => {
                    // Razorpay payment.failed — record it as a failed attempt.
                    settled.current = true;
                    markPaymentFailed({ razorpay_order_id: orderId });
                    setMsg({ ok: false, text: resp?.error?.description || 'Payment failed. Please try again.' });
                    setProcessing(null);
                },
            );

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
        <div className="min-h-screen bg-surface text-fg">
            <PageBackground />
            <Header />

            <main className="max-w-5xl mx-auto px-4 pt-10 pb-28">
                {/* Hero */}
                <div className="text-center max-w-xl mx-auto mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/25 bg-brand-500/10 mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                        <span className="text-theme-2xs font-semibold uppercase tracking-widest text-brand-300/80">Plans & Billing</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f0eeff]">
                        Do more with your groups
                    </h1>
                    <p className="text-fg-muted text-sm mt-3 leading-relaxed">
                        Start free, upgrade when you grow. One-time payment unlocks access for the full billing period —
                        no auto-renewal surprises.
                    </p>

                    <div className="mt-4 inline-flex items-center gap-2 text-theme-xs text-fg-muted">
                        <span>Current plan:</span>
                        <span className={`px-2 py-0.5 rounded-md font-semibold ${TIER_THEME[currentTier].chip}`} translate="no">
                            {currentTier}
                        </span>
                        {status === 'grace' && <span className="text-warning-300/80">· grace period</span>}
                        {status === 'expired' && <span className="text-error-300/80">· expired</span>}
                        {expiryLabel && status !== 'expired' && <span>· renews/expires {expiryLabel}</span>}
                    </div>
                </div>

                {/* promo code — directly below the current plan */}
                <div className="mb-8 max-w-md mx-auto rounded-2xl border border-line bg-surface-raised p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-brand-300" viewBox="0 0 16 16" fill="none">
                            <path d="M2 6.5l5-4 7 3-1 7-7 1-4-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                            <circle cx="6" cy="6" r="1" fill="currentColor" />
                        </svg>
                        <h3 className="text-theme-sm font-semibold text-fg">Have a promo code?</h3>
                    </div>
                    <p className="text-theme-xs text-fg-muted mb-3">
                        Enter it to unlock your plan instantly — no payment needed.
                    </p>

                    {/* Featured offer — tap to fill the field. */}
                    <button
                        type="button"
                        onClick={() => setPromoCode(FEATURED_PROMO)}
                        className="w-full mb-3 flex items-center justify-between gap-3 rounded-xl border border-warning-400/25 bg-warning-400/[0.06] px-3.5 py-2.5 text-left hover:border-warning-400/40 hover:bg-warning-400/[0.1] transition-colors"
                    >
                        <div className="min-w-0">
                            <p className="font-mono text-theme-xs tracking-wider text-warning-200 truncate">{FEATURED_PROMO}</p>
                            <p className="text-theme-2xs text-warning-200/50 mt-0.5">Free Premium trial valid until December 31, 2026</p>
                        </div>
                        <span className="text-theme-2xs font-semibold text-warning-200/80 shrink-0">Tap to use</span>
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
                            className="flex-1 bg-surface-hover border border-line rounded-xl px-4 py-2.5 text-sm font-mono tracking-wider text-fg placeholder:text-fg-subtle outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/10 transition-all"
                        />
                        <button
                            onClick={handleRedeem}
                            disabled={redeeming || !promoCode.trim()}
                            className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-brand-500/80 border border-brand-500/50 text-on-accent hover:bg-brand-500 active:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {redeeming ? 'Applying…' : 'Apply'}
                        </button>
                    </div>
                </div>

                {/* Billing cycle toggle */}
                <div className="flex justify-center mb-8">
                    <div className="inline-flex items-center gap-1 bg-surface-raised border border-line rounded-2xl p-1.5">
                        {(['monthly', 'yearly'] as BillingCycle[]).map((c) => (
                            <button
                                key={c}
                                onClick={() => setCycle(c)}
                                className={`relative px-5 py-2 rounded-xl text-theme-sm font-semibold transition-all duration-150 ${
                                    cycle === c ? 'bg-brand-500/20 text-brand-100 shadow-sm' : 'text-fg-muted hover:text-fg'
                                }`}
                            >
                                {c === 'monthly' ? 'Monthly' : 'Yearly'}
                                {c === 'yearly' && (
                                    <span className="ml-2 text-theme-2xs font-bold px-1.5 py-0.5 rounded bg-success-500/20 text-success-300 align-middle">
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
                                ? 'bg-success-500/[0.06] border-success-500/20 text-success-300'
                                : 'bg-error-500/[0.06] border-error-500/15 text-error-300'
                        }`}
                    >
                        {msg.text}
                    </div>
                )}

                {/* Tier cards */}
                {plansLoading || !plansData ? (
                    <div className="grid sm:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-[520px] rounded-3xl bg-surface-raised border border-line animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-3 gap-4 items-start">
                        {TIER_ORDER.map((tier) => {
                            const cfg = plansData[tier];
                            const theme = TIER_THEME[tier];
                            const isCurrent = tier === currentTier;
                            // Block buying a strictly lower tier while a paid plan is
                            // still active/grace (an expired plan resolves to FREE).
                            const isDowngrade = status !== 'expired' && PLAN_RANK[tier] < PLAN_RANK[currentTier];
                            const isPopular = tier === 'PRO';
                            const price = cycle === 'yearly' ? cfg.priceYearly : cfg.priceMonthly;
                            const perMonth = cycle === 'yearly' && price > 0 ? Math.round(price / 12) : null;

                            return (
                                <div
                                    key={tier}
                                    className={`relative rounded-3xl border p-6 flex flex-col bg-surface-raised transition-transform duration-200 ${theme.ring} ${
                                        isPopular ? 'sm:-translate-y-3' : ''
                                    }`}
                                >
                                    {/* top accent line */}
                                    <div className={`absolute top-0 left-8 right-8 h-px bg-gradient-to-r ${theme.glow}`} />

                                    {isPopular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-500 text-on-accent text-theme-2xs font-bold uppercase tracking-wider shadow-lg shadow-brand-900/40">
                                            Most popular
                                        </div>
                                    )}

                                    {/* header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${theme.chip}`}>
                                                {theme.icon}
                                            </span>
                                            <h2 className="text-theme-xl font-semibold text-[#f0eeff]">{cfg.name}</h2>
                                        </div>
                                        {isCurrent && (
                                            <span className="text-theme-2xs font-semibold px-2 py-0.5 rounded-md border border-line-strong bg-surface-hover text-fg">
                                                Current
                                            </span>
                                        )}
                                    </div>

                                    {/* price */}
                                    <div className="mt-5 mb-1">
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-4xl font-bold text-fg tracking-tight" translate="no">
                                                ₹{price}
                                            </span>
                                            {tier !== 'FREE' && (
                                                <span className="text-sm text-fg-muted">{cycle === 'yearly' ? '/year' : '/month'}</span>
                                            )}
                                        </div>
                                        <p className="text-theme-xs text-fg-muted mt-1 h-4" translate="no">
                                            {tier === 'FREE'
                                                ? 'Free forever'
                                                : perMonth !== null
                                                ? `≈ ₹${perMonth}/mo · billed once a year`
                                                : 'Billed once a month'}
                                        </p>
                                    </div>

                                    <div className="my-5 h-px bg-surface-hover" />

                                    {/* features */}
                                    <ul className="space-y-2.5 flex-1">
                                        {featureLines(tier, cfg).map((line) => (
                                            <li key={line} className="flex items-start gap-2.5 text-[12.5px] text-fg leading-snug">
                                                <svg className="w-4 h-4 mt-0.5 shrink-0 text-success-400/80" viewBox="0 0 16 16" fill="none">
                                                    <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.12" />
                                                    <path d="M5 8.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {line}
                                            </li>
                                        ))}
                                    </ul>

                                    {/* CTA */}
                                    <button
                                        disabled={tier === 'FREE' || isCurrent || isDowngrade || processing !== null}
                                        onClick={() => handleUpgrade(tier)}
                                        className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed ${
                                            tier === 'FREE' || isCurrent || isDowngrade ? theme.cta : `${theme.cta} disabled:opacity-60`
                                        }`}
                                    >
                                        {processing === tier
                                            ? 'Processing…'
                                            : isCurrent
                                            ? 'Your current plan'
                                            : isDowngrade
                                            ? 'Lower than your plan'
                                            : tier === 'FREE'
                                            ? 'Included'
                                            : `Upgrade to ${cfg.name}`}
                                    </button>
                                    {isDowngrade && (
                                        <p className="mt-2 text-[10.5px] text-fg-muted text-center leading-snug">
                                            You're on {currentTier}. Downgrades take effect after it expires.
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* trust footer */}
                <div className="mt-8 flex flex-col items-center gap-3 text-center">
                    <div className="flex items-center gap-2 text-theme-xs text-fg-muted">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                            <rect x="2.5" y="6" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
                            <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.1" />
                        </svg>
                        Secured by Razorpay · Cards, UPI & Net Banking
                    </div>
                    <button onClick={() => navigate('/groups')} className="text-brand-400 text-xs hover:text-brand-300 transition-colors">
                        ← Back to groups
                    </button>
                </div>
            </main>
        </div>
    );
}
