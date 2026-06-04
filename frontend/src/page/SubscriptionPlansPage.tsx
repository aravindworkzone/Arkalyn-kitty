import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui';
import ContactModal from '../components/ContactModal';
import type { ContactKind } from '../interface/contact';
import {
    PUBLIC_PLANS,
    TIER_ORDER,
    BILLING_PERIOD_DAYS,
    GRACE_PERIOD_DAYS,
    fmtLimit,
    fmtDays,
} from '../helpers/plans';
import type { PlanTier } from '../interface/subscription';

// A public, policy-style "everything about our plans" page. Long-form and
// text-first (like a Terms / Privacy page) rather than a checkout surface —
// the actual upgrade/checkout lives in the authenticated PricingPage.

const LAST_UPDATED = 'June 4, 2026';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
    return (
        <section id={id} className="scroll-mt-24 border-t border-stone-200 dark:border-stone-800 py-10 first:border-t-0">
            <h2 className="text-2xl font-bold tracking-[-0.02em] text-stone-950 dark:text-stone-50 mb-4">{title}</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-stone-600 dark:text-stone-300">{children}</div>
        </section>
    );
}

// Each row compares a single limit/feature across all three tiers.
const COMPARISON: { label: string; value: (t: PlanTier) => string }[] = [
    { label: 'Active groups', value: (t) => fmtLimit(PUBLIC_PLANS[t].limits.maxGroups) },
    { label: 'Members per group', value: (t) => fmtLimit(PUBLIC_PLANS[t].limits.maxMembersPerGroup) },
    { label: 'Categories per group', value: (t) => fmtLimit(PUBLIC_PLANS[t].limits.maxCategoriesPerGroup) },
    { label: 'Transaction history', value: (t) => fmtDays(PUBLIC_PLANS[t].limits.transactionLogRetentionDays) },
    { label: 'Activity log history', value: (t) => fmtDays(PUBLIC_PLANS[t].limits.eventLogRetentionDays) },
    { label: 'This & last month reports', value: () => 'Yes' },
    { label: 'All-time & custom-range reports', value: (t) => (PUBLIC_PLANS[t].features.advancedReportRange ? 'Yes' : '—') },
    { label: 'One-click group clone', value: (t) => (PUBLIC_PLANS[t].features.cloneGroup ? 'Yes' : '—') },
];

const TOC: [string, string][] = [
    ['overview', '1. Overview'],
    ['tiers', '2. The three plans'],
    ['compare', '3. Full feature comparison'],
    ['billing', '4. Billing & payments'],
    ['expiry', '5. Renewal, grace period & expiry'],
    ['promo', '6. Promo codes'],
    ['refunds', '7. Refunds & cancellation'],
    ['data', '8. Your data & downgrades'],
    ['faq', '9. Frequently asked questions'],
];

const TIER_ACCENT: Record<PlanTier, string> = {
    FREE: 'text-stone-500',
    PRO: 'text-violet-500',
    PREMIUM: 'text-amber-500',
};

export default function SubscriptionPlansPage() {
    const [contactOpen, setContactOpen] = useState(false);
    const [contactKind, setContactKind] = useState<ContactKind>('question');

    const openContact = (kind: ContactKind) => {
        setContactKind(kind);
        setContactOpen(true);
    };

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-950 dark:text-stone-50 font-sans antialiased">
            {/* Minimal header */}
            <header className="sticky top-0 z-40 border-b border-stone-200 dark:border-stone-800 bg-stone-50/85 dark:bg-stone-950/85 backdrop-blur-md pt-safe">
                <div className="max-w-screen-lg mx-auto px-6 max-[767px]:px-4 h-16 flex items-center gap-3">
                    <Link to="/" className="flex items-center gap-2 font-semibold text-[15px] tracking-tight flex-shrink-0">
                        <Logo variant="mini" className="h-9 w-9 rounded-md" />
                        <Logo variant="word" className="h-9 w-24 rounded-md" />
                    </Link>
                    <div className="flex-1" />
                    <Link to="/" className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors px-3 py-2">
                        ← Home
                    </Link>
                    <Link
                        to="/register"
                        className="inline-flex h-9 px-4 items-center rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-sm shadow-indigo-500/20"
                    >
                        Get started
                    </Link>
                </div>
            </header>

            {/* Title */}
            <div className="border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/40">
                <div className="max-w-screen-lg mx-auto px-6 max-[767px]:px-4 py-14 max-[767px]:py-10">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-3">Plans & Billing</p>
                    <h1 className="text-4xl max-[767px]:text-3xl font-bold tracking-[-0.025em] mb-3">
                        Subscription plans — full details
                    </h1>
                    <p className="text-base text-stone-500 dark:text-stone-400 max-w-2xl leading-relaxed">
                        Everything about what each plan includes, how billing works, and what happens when a plan expires.
                        Start free, upgrade only when your groups grow.
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-4">Last updated: {LAST_UPDATED}</p>
                </div>
            </div>

            <div className="max-w-screen-lg mx-auto px-6 max-[767px]:px-4 py-10 grid lg:grid-cols-[200px_1fr] gap-10">
                {/* Table of contents */}
                <aside className="hidden lg:block">
                    <nav className="sticky top-24 space-y-1">
                        {TOC.map(([id, label]) => (
                            <a
                                key={id}
                                href={`#${id}`}
                                className="block px-3 py-1.5 text-[13px] text-stone-500 dark:text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                            >
                                {label}
                            </a>
                        ))}
                    </nav>
                </aside>

                {/* Body */}
                <div className="min-w-0">
                    <Section id="overview" title="1. Overview">
                        <p>
                            Arkalyn — Kitty is a pooled-wallet expense tracker for groups. Every account starts on the{' '}
                            <strong className="text-stone-900 dark:text-stone-100">Free</strong> plan with no time limit and no card
                            required. As your groups get larger or you need longer history and advanced reports, two paid tiers —{' '}
                            <strong className="text-violet-600 dark:text-violet-400">Pro</strong> and{' '}
                            <strong className="text-amber-600 dark:text-amber-400">Premium</strong> — raise the limits and unlock extra
                            features.
                        </p>
                        <p>
                            Paid plans use a <strong className="text-stone-900 dark:text-stone-100">one-time, time-boxed</strong> model:
                            a single payment grants full access for the billing period you choose. There is{' '}
                            <strong className="text-stone-900 dark:text-stone-100">no auto-renewal</strong> — nothing is silently charged
                            to your card when the period ends.
                        </p>
                    </Section>

                    <Section id="tiers" title="2. The three plans">
                        <div className="grid sm:grid-cols-3 gap-4 not-prose">
                            {TIER_ORDER.map((tier) => {
                                const cfg = PUBLIC_PLANS[tier];
                                return (
                                    <div
                                        key={tier}
                                        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5"
                                    >
                                        <p className={`text-sm font-bold uppercase tracking-wide ${TIER_ACCENT[tier]}`} translate="no">
                                            {cfg.name}
                                        </p>
                                        <p className="mt-2 text-2xl font-bold text-stone-950 dark:text-stone-50" translate="no">
                                            ₹{cfg.priceMonthly}
                                            <span className="text-sm font-normal text-stone-400">{tier === 'FREE' ? '' : '/mo'}</span>
                                        </p>
                                        <p className="text-[11px] text-stone-400 mt-0.5" translate="no">
                                            {tier === 'FREE' ? 'Free forever' : `or ₹${cfg.priceYearly}/year`}
                                        </p>
                                        <p className="mt-3 text-[13px] text-stone-500 dark:text-stone-400 leading-relaxed">
                                            {tier === 'FREE'
                                                ? 'Best for a single household or a one-off trip.'
                                                : tier === 'PRO'
                                                ? 'For active organisers running several groups.'
                                                : 'For power users who want no limits at all.'}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                        <p>
                            Prices are in Indian Rupees (₹) and include applicable taxes. The yearly option is billed once for the full
                            year and works out roughly 20% cheaper than paying month by month.
                        </p>
                    </Section>

                    <Section id="compare" title="3. Full feature comparison">
                        <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800 not-prose">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-stone-100 dark:bg-stone-900">
                                        <th className="text-left font-semibold px-4 py-3 text-stone-600 dark:text-stone-300">Feature</th>
                                        {TIER_ORDER.map((t) => (
                                            <th key={t} className={`px-4 py-3 font-bold ${TIER_ACCENT[t]}`} translate="no">
                                                {PUBLIC_PLANS[t].name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {COMPARISON.map((row, i) => (
                                        <tr
                                            key={row.label}
                                            className={i % 2 ? 'bg-white dark:bg-stone-950' : 'bg-stone-50/60 dark:bg-stone-900/40'}
                                        >
                                            <td className="px-4 py-2.5 text-stone-600 dark:text-stone-300">{row.label}</td>
                                            {TIER_ORDER.map((t) => (
                                                <td
                                                    key={t}
                                                    className="px-4 py-2.5 text-center font-medium text-stone-700 dark:text-stone-200"
                                                    translate="no"
                                                >
                                                    {row.value(t)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[13px] text-stone-400">
                            “Unlimited” means there is no enforced cap. Retention windows control how far back transaction and activity
                            logs are kept and shown.
                        </p>
                    </Section>

                    <Section id="billing" title="4. Billing & payments">
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                Payments are processed securely by <strong className="text-stone-900 dark:text-stone-100">Razorpay</strong>.
                                We support credit/debit cards, UPI, and net banking. Card details are never stored on our servers.
                            </li>
                            <li>
                                Choose <strong>Monthly</strong> ({BILLING_PERIOD_DAYS.monthly} days of access) or{' '}
                                <strong>Yearly</strong> ({BILLING_PERIOD_DAYS.yearly} days of access) at checkout.
                            </li>
                            <li>
                                Each payment is a <strong>one-time charge</strong> for that period. We do not store a mandate and will
                                not auto-charge you for the next period.
                            </li>
                            <li>Upgrading takes effect immediately once payment is verified — no waiting and no re-login required.</li>
                        </ul>
                    </Section>

                    <Section id="expiry" title="5. Renewal, grace period & expiry">
                        <p>Because there is no auto-renewal, a paid plan simply runs to the end of its period. Here is the lifecycle:</p>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>
                                <strong className="text-stone-900 dark:text-stone-100">Active</strong> — full access to everything your
                                tier includes, until the expiry date.
                            </li>
                            <li>
                                <strong className="text-amber-600 dark:text-amber-400">Grace period</strong> — for{' '}
                                {GRACE_PERIOD_DAYS} days after expiry, your account keeps full paid access so a lapsed payment never locks
                                you out mid-month.
                            </li>
                            <li>
                                <strong className="text-stone-900 dark:text-stone-100">Downgraded to Free</strong> — after the grace
                                period, the account returns to Free entitlements. Nothing is deleted; resources that exceed Free limits
                                simply become <strong>read-only</strong> until you upgrade again or bring them under the limit.
                            </li>
                        </ol>
                        <p>You can re-subscribe at any time to instantly restore full access.</p>
                    </Section>

                    <Section id="promo" title="6. Promo codes">
                        <p>
                            A valid promo code can unlock a paid tier instantly with no payment. Enter it on the in-app{' '}
                            <Link to="/pricing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                Plans & Billing
                            </Link>{' '}
                            page after signing in.
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>Each code grants a specific tier for a fixed number of days, set when the code was issued.</li>
                            <li>A promo cannot downgrade an account that is already on a higher active plan.</li>
                            <li>Codes are case-insensitive and may be limited to a number of redemptions or an expiry date.</li>
                        </ul>
                    </Section>

                    <Section id="refunds" title="7. Refunds & cancellation">
                        <p>
                            Since plans are one-time and time-boxed, there is nothing to “cancel” — access simply ends when the period
                            does, and you are never charged again automatically. If you believe you were charged in error or a payment did
                            not unlock your plan, contact us and we will make it right.
                        </p>
                        <p>
                            Refund requests for accidental or duplicate charges are honoured per Razorpay’s settlement timelines. Reach us
                            at{' '}
                            <a href="mailto:aravind.workzone@gmail.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                aravind.workzone@gmail.com
                            </a>
                            .
                        </p>
                    </Section>

                    <Section id="data" title="8. Your data & downgrades">
                        <p>
                            Downgrading — whether by expiry or by choice — never deletes your groups, expenses, or history. The pooled
                            wallet, the immutable transaction trail, and your members all remain intact.
                        </p>
                        <p>
                            What changes is enforcement of limits: if you are over a Free limit (for example, more than 3 active groups),
                            those over-limit resources become read-only. You keep full visibility; you just can’t add new entries to them
                            until you upgrade or reduce below the limit.
                        </p>
                    </Section>

                    <Section id="faq" title="9. Frequently asked questions">
                        <div className="divide-y divide-stone-200 dark:divide-stone-800 border-y border-stone-200 dark:border-stone-800 not-prose">
                            {[
                                {
                                    q: 'Do I need a card to start?',
                                    a: 'No. The Free plan is fully usable forever with no card and no time limit.',
                                },
                                {
                                    q: 'Will I be charged automatically when my plan ends?',
                                    a: 'No. Every paid plan is a single one-time payment. We never store a mandate or auto-renew.',
                                },
                                {
                                    q: 'What happens to my data if I downgrade?',
                                    a: 'Nothing is deleted. Resources over the Free limit become read-only until you upgrade again.',
                                },
                                {
                                    q: 'Can I switch between monthly and yearly?',
                                    a: 'Yes — pick whichever you want each time you pay. Yearly is about 20% cheaper overall.',
                                },
                                {
                                    q: 'Is my payment secure?',
                                    a: 'Yes. All payments run through Razorpay; we never see or store your card details.',
                                },
                            ].map((f) => (
                                <details key={f.q} className="group py-4">
                                    <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
                                        <span className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{f.q}</span>
                                        <span className="w-6 h-6 flex items-center justify-center text-stone-400 group-open:rotate-45 transition-transform">
                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                            </svg>
                                        </span>
                                    </summary>
                                    <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mt-2 pr-10">{f.a}</p>
                                </details>
                            ))}
                        </div>
                    </Section>

                    {/* Still have questions? — contact options */}
                    <div className="mt-10 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 text-center">
                        <h3 className="text-xl font-bold text-stone-950 dark:text-stone-50 mb-2">Still have questions?</h3>
                        <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
                            Ask us anything about plans and billing, or report a problem — it reaches us by email and we’ll get back to you.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => openContact('question')}
                                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-md shadow-indigo-500/20"
                            >
                                Ask a question
                            </button>
                            <button
                                type="button"
                                onClick={() => openContact('report')}
                                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-medium bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-400 transition-colors"
                            >
                                Report a problem
                            </button>
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/20 p-8 text-center">
                        <h3 className="text-xl font-bold text-stone-950 dark:text-stone-50 mb-2">Ready when you are.</h3>
                        <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
                            Create your account free, then upgrade inside the app whenever you need more.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <Link
                                to="/register"
                                className="inline-flex items-center h-11 px-6 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-md shadow-indigo-500/20"
                            >
                                Get started — it’s free
                            </Link>
                            <Link
                                to="/pricing"
                                className="inline-flex items-center h-11 px-6 rounded-xl text-sm font-medium bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-400 transition-colors"
                            >
                                Manage my plan
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} initialKind={contactKind} />
        </div>
    );
}
