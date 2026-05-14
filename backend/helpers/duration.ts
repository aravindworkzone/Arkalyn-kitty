const UNIT_MS: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
};

export const parseDurationMs = (input: string): number => {
    const match = input.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
    if (!match) {
        throw new Error(
            `Invalid duration "${input}". Expected format like "15m", "2h", "7d".`
        );
    }
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    return value * UNIT_MS[unit];
};
