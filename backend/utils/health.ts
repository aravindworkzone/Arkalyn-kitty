import mongoose from 'mongoose';
import { getRecentLogs, type CapturedLog } from './recentLogs';

// Mongoose connection.readyState codes → labels.
const READY_STATE_LABELS: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
};

export interface SystemHealth {
    server: { status: 'up'; uptimeSec: number; memoryMB: number; timestamp: string };
    db: { status: string; connected: boolean; responseMs: number | null };
    recentLogs: CapturedLog[];
}

export const getSystemHealthSnapshot = async (opts?: { ping?: boolean; minLogLevel?: number }): Promise<SystemHealth> => {
    const readyState = mongoose.connection.readyState;
    const connected = readyState === 1;

    let responseMs: number | null = null;
    if (opts?.ping && connected && mongoose.connection.db) {
        const start = Date.now();
        try {
            await mongoose.connection.db.admin().ping();
            responseMs = Date.now() - start;
        } catch {
            responseMs = null;
        }
    }

    return {
        server: {
            status: 'up',
            uptimeSec: Math.round(process.uptime()),
            memoryMB: Math.round(process.memoryUsage().rss / 1048576),
            timestamp: new Date().toISOString(),
        },
        db: {
            status: READY_STATE_LABELS[readyState] ?? 'unknown',
            connected,
            responseMs,
        },
        recentLogs: getRecentLogs(opts?.minLogLevel ?? 40),
    };
};
