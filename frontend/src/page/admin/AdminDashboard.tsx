import { useState } from 'react';
import { PageBackground, PageContainer } from '../../components/ui';
import UsersSection from '../../components/admin/UsersSection';
import PromosSection from '../../components/admin/PromosSection';
import SubscriptionsSection from '../../components/admin/SubscriptionsSection';
import AnalyticsSection from '../../components/admin/AnalyticsSection';
import DemandSection from '../../components/admin/DemandSection';
import HealthSection from '../../components/admin/HealthSection';

const TABS = [
    { id: 'users', label: 'Users' },
    { id: 'promos', label: 'Promo Codes' },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'demand', label: 'Demand' },
    { id: 'health', label: 'System Health' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AdminDashboard() {
    const [tab, setTab] = useState<TabId>('analytics');

    return (
        <div className="min-h-screen bg-surface text-fg">
            <PageBackground />

            <PageContainer width="wide">
                <div>
                    <p className="text-theme-xs font-medium tracking-widest uppercase text-warning-700 dark:text-warning-300 mb-1">
                        Owner Console
                    </p>
                    <h1 className="text-2xl font-semibold text-[#f0eeff] tracking-tight">Admin Dashboard</h1>
                </div>

                {/* tab nav */}
                <div className="flex gap-1.5 bg-surface-raised border border-line rounded-xl p-1 mb-6 overflow-x-auto">
                    {TABS.map((tb) => (
                        <button
                            key={tb.id}
                            onClick={() => setTab(tb.id)}
                            className={`flex-1 whitespace-nowrap py-2 px-3 rounded-lg text-theme-xs font-semibold transition-colors ${
                                tab === tb.id ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300' : 'text-fg-muted hover:text-fg'
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
                {tab === 'demand' && <DemandSection />}
                {tab === 'health' && <HealthSection />}
            </PageContainer>
        </div>
    );
}
