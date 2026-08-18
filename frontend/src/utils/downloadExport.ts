const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export type ExportSheet = 'ledger' | 'expenses' | 'members' | 'audit-pack';

export class ExportError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'ExportError';
    }
}

const filenameFrom = (res: Response, fallback: string): string => {
    const cd = res.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^"]+)"?/.exec(cd);
    return match?.[1] ?? fallback;
};

const request = (groupId: string, sheet: ExportSheet): Promise<Response> =>
    fetch(`${API}/export/${encodeURIComponent(groupId)}/${sheet}`, {
        method: 'GET',
        credentials: 'include',
    });

export const downloadGroupExport = async (
    groupId: string,
    sheet: ExportSheet
): Promise<void> => {
    let res = await request(groupId, sheet);

    // Mirror base.ts's single retry behind a token refresh. A download often
    // happens minutes into a session, which is exactly when the 15-minute access
    // token has lapsed.
    if (res.status === 401) {
        const refreshed = await fetch(`${API}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
        });
        if (refreshed.ok) res = await request(groupId, sheet);
    }

    if (!res.ok) {
        // Errors still travel as the app's normal JSON envelope, so the 402 from
        // an unentitled group surfaces its real upgrade message rather than a
        // generic failure.
        let message = 'Export failed. Please try again.';
        try {
            const body = await res.json();
            if (body?.message) message = body.message;
        } catch {
            // Non-JSON error body — keep the default.
        }
        throw new ExportError(message, res.status);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameFrom(res, `${groupId}-${sheet}.csv`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking synchronously can cancel the download in Safari; a tick is enough
    // for the navigation to have been queued.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
