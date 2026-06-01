import type { ReactNode } from 'react';

export const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN');

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
    return (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-4 py-3.5">
            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{label}</p>
            <p className="text-xl font-semibold text-[#e8e3ff]" translate="no">{value}</p>
            {sub && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
        </div>
    );
}

export function Bars({ data, color = '#818cf8' }: { data: { label: string; value: number }[]; color?: string }) {
    const max = Math.max(...data.map((d) => d.value), 1);
    return (
        <div className="space-y-2">
            {data.map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                    <span className="text-[11px] text-white/45 w-24 shrink-0 truncate" translate="no">{d.label}</span>
                    <div className="flex-1 h-3 rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
                    </div>
                    <span className="text-[11px] font-mono text-white/55 w-10 text-right" translate="no">{d.value}</span>
                </div>
            ))}
        </div>
    );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5">
            <h2 className="text-[13px] font-semibold text-white/80 mb-4">{title}</h2>
            {children}
        </div>
    );
}

export function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        ACTIVE: 'bg-emerald-500/15 text-emerald-300',
        SUSPENDED: 'bg-amber-500/15 text-amber-300',
        DELETED: 'bg-red-500/15 text-red-300',
    };
    return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${map[status] ?? 'bg-white/[0.06] text-white/40'}`}>
            {status}
        </span>
    );
}

export function TierBadge({ tier }: { tier: string }) {
    const map: Record<string, string> = {
        FREE: 'bg-white/[0.06] text-white/45',
        PRO: 'bg-violet-500/15 text-violet-300',
        PREMIUM: 'bg-amber-400/15 text-amber-300',
    };
    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${map[tier] ?? ''}`} translate="no">{tier}</span>;
}
