import { useState } from 'react';
import { useGetDemandQuery } from '../../redux/api/admin';
import { Panel, StatCard } from './adminUi';

/**
 * What customers tried to do and were told their plan wouldn't allow.
 *
 * The rest of the admin dashboard reports what happened. This reports what
 * people WANTED — the only screen here that answers "what should we price
 * differently" rather than "how did we do". Every row is someone who wanted a
 * capability enough to walk into a wall for it.
 *
 * Sorted by distinct GROUPS, not raw hits, and the table leads with that column:
 * a hundred hits from two groups is one loud customer retrying, while twelve
 * hits across twelve groups is a tier boundary drawn in the wrong place.
 */

const WINDOWS = [7, 30, 90] as const;

// Route strings are precise but unreadable in a table. Mapping the ones we
// actually gate keeps the column scannable; anything unmapped falls through to
// the raw route rather than being hidden.
const GATE_LABELS: Record<string, string> = {
    'POST /api/grouplink/request': 'Receive funding from another group',
    'POST /api/grouplink/approve': 'Approve a funding link',
    'POST /api/grouplink/transfer': 'Send funds to a linked group',
    'GET /api/export/:groupId/:sheet': 'Export records (CSV / audit pack)',
    'POST /api/group/:groupId/clone': 'Clone a group',
    'POST /api/group/:groupId/members': 'Add a member past the cap',
    'POST /api/category': 'Add a category past the cap',
};

const prettyGate = (gate: string) => GATE_LABELS[gate] ?? gate;

export default function DemandSection() {
    const [days, setDays] = useState<number>(30);
    const { data, isLoading } = useGetDemandQuery({ days });

    if (isLoading || !data) {
        return <div className="h-64 rounded-2xl bg-surface-raised border border-line animate-pulse" />;
    }

    const { totals, gates } = data;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard
                    label="Groups blocked"
                    value={totals.groups}
                    sub={`in the last ${days} days`}
                />
                <StatCard label="People blocked" value={totals.users} />
                <StatCard label="Total blocks" value={totals.hits} />
            </div>

            <Panel title="What people couldn't do">
                <div className="flex gap-1.5 mb-4">
                    {WINDOWS.map((w) => (
                        <button
                            key={w}
                            type="button"
                            onClick={() => setDays(w)}
                            className={
                                'px-2.5 py-1 rounded-lg text-theme-2xs font-semibold transition-colors ' +
                                (days === w
                                    ? 'bg-brand-500 text-white'
                                    : 'bg-surface-hover text-fg-muted hover:text-fg')
                            }
                        >
                            {w}d
                        </button>
                    ))}
                </div>

                {gates.length === 0 ? (
                    <p className="text-theme-xs text-fg-muted">
                        Nobody hit a paywall in this window. Either the free tier is generous
                        enough that nobody is pushing against it — or not enough people are
                        using the product yet to push.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-theme-xs">
                            <thead>
                                <tr className="text-left text-fg-muted border-b border-line">
                                    <th className="pb-2 font-medium">Blocked action</th>
                                    <th className="pb-2 font-medium text-right">Groups</th>
                                    <th className="pb-2 font-medium text-right">Hits</th>
                                    <th className="pb-2 font-medium text-right">Last</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gates.map((g) => (
                                    <tr key={g.gate} className="border-b border-line/50 last:border-0">
                                        <td className="py-2 pr-3">
                                            <span className="font-medium">{prettyGate(g.gate)}</span>
                                            <span className="block text-theme-2xs text-fg-muted truncate max-w-md">
                                                {g.sample}
                                            </span>
                                        </td>
                                        <td className="py-2 text-right font-semibold tabular-nums">
                                            {g.groups}
                                        </td>
                                        <td className="py-2 text-right tabular-nums text-fg-muted">
                                            {g.hits}
                                        </td>
                                        <td className="py-2 text-right text-fg-muted whitespace-nowrap">
                                            {new Date(g.lastAt).toLocaleDateString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                            })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
}
