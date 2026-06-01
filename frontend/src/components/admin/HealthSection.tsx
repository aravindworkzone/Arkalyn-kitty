import { useEffect, useState } from 'react';
import { socket } from '../../socket/socket';
import { useGetAdminHealthQuery } from '../../redux/api/admin';
import type { SystemHealth } from '../../interface/admin';
import { StatCard, Panel } from './adminUi';

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
        return <div className="h-64 rounded-2xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />;
    }

    const logs = health.recentLogs.filter((l) => l.level >= minLevel);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] text-white/35">
                <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
                {live ? 'Live · updates every 5s' : 'Snapshot'}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Server" value={<span className="text-emerald-300">Up</span>} sub={`uptime ${formatUptime(health.server.uptimeSec)}`} />
                <StatCard label="Memory (RSS)" value={`${health.server.memoryMB} MB`} />
                <StatCard
                    label="MongoDB"
                    value={<span className={health.db.connected ? 'text-emerald-300' : 'text-red-300'}>{health.db.status}</span>}
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
                            className={`px-3 py-1 rounded-lg text-[11px] font-semibold ${
                                minLevel === o.l ? 'bg-violet-500/15 text-violet-200' : 'text-white/40 hover:text-white/65'
                            }`}
                        >
                            {o.t}
                        </button>
                    ))}
                </div>
                {logs.length === 0 ? (
                    <p className="text-white/30 text-xs">No logs at this level — all clear.</p>
                ) : (
                    <div className="space-y-1.5 max-h-80 overflow-y-auto">
                        {logs.map((l, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                                <span
                                    className={`px-1.5 py-0.5 rounded shrink-0 uppercase ${
                                        l.level >= 50 ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'
                                    }`}
                                >
                                    {l.levelLabel}
                                </span>
                                <span className="text-white/30 shrink-0">{new Date(l.time).toLocaleTimeString('en-GB')}</span>
                                <span className="text-white/60 break-all">{l.msg || '—'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Panel>
        </div>
    );
}
