import { useEffect, useState } from 'react';
import { socket } from '../../socket/socket';
import { useGetAdminHealthQuery } from '../../redux/api/admin';
import type { SystemHealth } from '../../interface/admin';
import { StatCard, Panel } from './adminUi';
import Badge from '../ui/Badge';

const SYSTEM_HEALTH = 'admin:system-health';

const formatUptime = (sec: number) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export default function HealthSection() {
    const { data: initial } = useGetAdminHealthQuery();
    const [live, setLive] = useState<SystemHealth | null>(null);
    const [minLevel, setMinLevel] = useState(40);

    useEffect(() => {
        if (!socket.connected) socket.connect();
        const handler = (snap: SystemHealth) => setLive(snap);
        socket.on(SYSTEM_HEALTH, handler);
        return () => {
            socket.off(SYSTEM_HEALTH, handler);
        };
    }, []);

    const health = live ?? initial;
    if (!health) {
        return <div className="h-64 rounded-2xl bg-surface-raised border border-line animate-pulse" />;
    }

    const logs = health.recentLogs.filter((l) => l.level >= minLevel);

    return (
        <div className="space-y-4">
            {/* Status is a badge, never raw coloured text (UI_PROMPT). Both
                indicators pair the colour with a word, so the state is still
                readable with no colour perception at all. */}
            <div className="flex items-center gap-2 text-theme-xs text-fg-muted">
                <Badge tone={live ? 'success' : 'gray'}>
                    <span className={`mr-1.5 w-1.5 h-1.5 rounded-full ${live ? 'bg-success-500 animate-pulse' : 'bg-fg-subtle'}`} />
                    {live ? 'Live' : 'Snapshot'}
                </Badge>
                {live && 'updates every 5s'}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Server" value={<Badge tone="success">Up</Badge>} sub={`uptime ${formatUptime(health.server.uptimeSec)}`} />
                <StatCard label="Memory (RSS)" value={`${health.server.memoryMB} MB`} />
                <StatCard
                    label="MongoDB"
                    value={<Badge tone={health.db.connected ? 'success' : 'error'}>{health.db.status}</Badge>}
                />
                <StatCard label="DB response" value={health.db.responseMs != null ? `${health.db.responseMs} ms` : '—'} />
            </div>

            <Panel title="Recent error logs (last 50)">
                <div className="flex gap-1.5 mb-3">
                    {[
                        { l: 40, t: 'Warn+' },
                        { l: 50, t: 'Error only' },
                    ].map((o) => (
                        <button
                            key={o.l}
                            onClick={() => setMinLevel(o.l)}
                            className={`px-3 py-1 rounded-lg text-theme-xs font-semibold ${
                                minLevel === o.l ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300' : 'text-fg-muted hover:text-fg'
                            }`}
                        >
                            {o.t}
                        </button>
                    ))}
                </div>
                {logs.length === 0 ? (
                    <p className="text-fg-muted text-xs">No logs at this level — all clear.</p>
                ) : (
                    <div className="space-y-1.5 max-h-80 overflow-y-auto">
                        {logs.map((l, i) => (
                            <div key={i} className="flex items-start gap-2 text-theme-xs font-mono">
                                <Badge tone={l.level >= 50 ? 'error' : 'warning'} className="shrink-0 uppercase !rounded">
                                    {l.levelLabel}
                                </Badge>
                                <span className="text-fg-muted shrink-0">{new Date(l.time).toLocaleTimeString('en-GB')}</span>
                                <span className="text-fg break-all">{l.msg || '—'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Panel>
        </div>
    );
}
