// In-memory ring buffer of recent warn/error logs for the owner dashboard's
// System Health panel. Fed by a pino multistream (see logger.ts). Holds at most
// MAX entries; survives only for the process lifetime (not persisted).

export interface CapturedLog {
    level: number;
    levelLabel: string;
    time: number;
    msg?: string;
    err?: unknown;
}

const LEVEL_LABELS: Record<number, string> = {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal',
};

const MAX = 50;
const buffer: CapturedLog[] = [];

// pino writes one NDJSON line per log; parse and keep the bits the dashboard shows.
export const recentLogStream = {
    write(line: string): void {
        try {
            const o = JSON.parse(line);
            const level = typeof o.level === 'number' ? o.level : 30;
            const entry: CapturedLog = {
                level,
                levelLabel: LEVEL_LABELS[level] ?? String(level),
                time: typeof o.time === 'number' ? o.time : Date.now(),
                msg: o.msg,
            };
            if (o.err) entry.err = o.err;
            buffer.push(entry);
            if (buffer.length > MAX) buffer.shift();
        } catch {
            /* ignore non-JSON chunks */
        }
    },
};

// Newest first, filtered by minimum level (40 = warn, 50 = error).
export const getRecentLogs = (minLevel = 40): CapturedLog[] =>
    buffer.filter((l) => l.level >= minLevel).slice().reverse();
