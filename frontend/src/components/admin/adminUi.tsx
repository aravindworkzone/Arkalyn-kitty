import type { ReactNode } from 'react';
import Badge, { type BadgeTone } from '../ui/Badge';

export const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN');

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
    return (
        <div className="rounded-xl bg-surface-raised border border-line px-5 py-4 shadow-theme-xs">
            <p className="text-theme-2xs uppercase tracking-widest text-fg-muted mb-1">{label}</p>
            <p className="text-theme-xl font-semibold text-fg" translate="no">{value}</p>
            {sub && <p className="text-theme-2xs text-fg-muted mt-0.5">{sub}</p>}
        </div>
    );
}

/**
 * Horizontal magnitude bars — one series, so no legend: the Panel title names
 * it, and every row is direct-labelled with its own name and value. Flat brand
 * fill by default rather than a per-row colour: these compare magnitudes of one
 * measure, and colouring by rank would repaint rows as the data reorders.
 */
export function Bars({ data }: { data: { label: string; value: number }[] }) {
    const max = Math.max(...data.map((d) => d.value), 1);
    return (
        <div className="space-y-2">
            {data.map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                    <span className="text-theme-xs text-fg-muted w-24 shrink-0 truncate" translate="no">{d.label}</span>
                    <div className="flex-1 h-3 rounded-full bg-line overflow-hidden">
                        <div
                            className="h-full rounded-full bg-brand-500 transition-all duration-500"
                            style={{ width: `${(d.value / max) * 100}%` }}
                        />
                    </div>
                    <span className="text-theme-xs font-mono text-fg w-10 text-right" translate="no">{d.value}</span>
                </div>
            ))}
        </div>
    );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="rounded-2xl bg-surface-raised border border-line p-5 shadow-theme-xs">
            <h2 className="text-theme-sm font-semibold text-fg mb-4">{title}</h2>
            {children}
        </div>
    );
}

// UI_PROMPT's rule: status is always a badge, never raw coloured text. Both of
// these now map onto the shared Badge rather than carrying their own colours.
const STATUS_TONE: Record<string, BadgeTone> = {
    ACTIVE: 'success',
    SUSPENDED: 'warning',
    DELETED: 'error',
};

export function StatusBadge({ status }: { status: string }) {
    return <Badge tone={STATUS_TONE[status] ?? 'gray'}>{status}</Badge>;
}

const TIER_TONE: Record<string, BadgeTone> = {
    FREE: 'gray',
    PRO: 'brand',
    PREMIUM: 'warning',
};

export function TierBadge({ tier }: { tier: string }) {
    return <Badge tone={TIER_TONE[tier] ?? 'gray'} translate="no">{tier}</Badge>;
}
