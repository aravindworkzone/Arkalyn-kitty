import { useState } from 'react';
import Header from '../../components/header';
import { PageBackground } from '../../components/ui';
import UsersSection from '../../components/admin/UsersSection';
import PromosSection from '../../components/admin/PromosSection';
import SubscriptionsSection from '../../components/admin/SubscriptionsSection';
import AnalyticsSection from '../../components/admin/AnalyticsSection';
import HealthSection from '../../components/admin/HealthSection';

const TABS = [
    { id: 'users', label: 'Users' },
    { id: 'promos', label: 'Promo Codes' },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'health', label: 'System Health' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AdminDashboard() {
    const [tab, setTab] = useState<TabId>('analytics');

    return (
        <div className="min-h-screen bg-[#080c14] text-white">
            <PageBackground />
            <Header />

            <main className="max-w-5xl mx-auto px-4 pt-6 pb-24">
                <div className="mb-6">
                    <p className="text-[11px] font-medium tracking-widest uppercase text-amber-400/70 mb-1">
                        Owner Console
                    </p>
                    <h1 className="text-2xl font-semibold text-[#f0eeff] tracking-tight">Admin Dashboard</h1>
                </div>

                {/* tab nav */}
                <div className="flex gap-1.5 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1 mb-6 overflow-x-auto">
                    {TABS.map((tb) => (
                        <button
                            key={tb.id}
                            onClick={() => setTab(tb.id)}
                            className={`flex-1 whitespace-nowrap py-2 px-3 rounded-lg text-[12px] font-semibold transition-colors ${
                                tab === tb.id ? 'bg-violet-500/15 text-violet-200' : 'text-white/40 hover:text-white/65'
                            }`}
                        >
                            {tb.label}
                        </button>
                    ))}
                </div>

                {tab === 'users' && <UsersSection />}
                {tab === 'promos' && <PromosSection />}
                {tab === 'subscriptions' && <SubscriptionsSection />}
                {tab === 'analytics' && <AnalyticsSection />}
                {tab === 'health' && <HealthSection />}
            </main>
        </div>
    );
}
