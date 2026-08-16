import { useEffect } from 'react';
import { useGetAdminUserDetailQuery } from '../../redux/api/admin';
import { TierBadge, StatusBadge } from './adminUi';

// Account-level detail only. Plans belong to groups, so the tier of each group
// is shown in the list below and the override lives in the Subscriptions tab
// alongside every other group.
export default function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
    const { data, isLoading } = useGetAdminUserDetailQuery(userId);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return (
        <div className="fixed inset-0 z-modal flex justify-center overflow-y-auto p-4 bg-scrim backdrop-blur-[2px]">
            <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
            <div className="relative my-auto w-full max-w-lg rounded-2xl border border-line bg-surface-overlay p-5 max-h-[85vh] overflow-y-auto">
                {isLoading || !data ? (
                    <p className="text-fg-muted text-sm">Loading…</p>
                ) : (
                    <>
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="text-theme-sm font-semibold text-fg">{data.user.name}</h3>
                                <p className="text-theme-xs text-fg-muted">{data.user.email}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <StatusBadge status={data.user.status} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-theme-xs text-fg-muted mb-4">
                            <p>Joined: <span className="text-fg">{new Date(data.user.createdAt).toLocaleDateString('en-IN')}</span></p>
                            <p>Role: <span className="text-fg">{data.user.role}</span></p>
                            <p className="col-span-2">Last login: <span className="text-fg">
                                {data.user.lastLoginAt
                                    ? new Date(data.user.lastLoginAt).toLocaleString('en-IN', {
                                          day: '2-digit', month: 'short', year: 'numeric',
                                          hour: '2-digit', minute: '2-digit', hour12: true,
                                      })
                                    : '—'}
                            </span></p>
                        </div>

                        <p className="text-theme-xs uppercase tracking-widest text-fg-muted mb-2">Groups ({data.groups.length})</p>
                        <div className="space-y-1.5 mb-5 max-h-40 overflow-y-auto">
                            {data.groups.length === 0 ? (
                                <p className="text-fg-muted text-xs">No groups.</p>
                            ) : (
                                data.groups.map((g) => (
                                    <div key={g._id} className="flex items-center justify-between gap-2 text-theme-xs border-b border-line pb-1.5">
                                        <div className="min-w-0">
                                            <p className="text-fg truncate">{g.name}</p>
                                            <p className="text-fg-muted text-theme-2xs">
                                                Last action:{' '}
                                                {g.lastActionAt
                                                    ? new Date(g.lastActionAt).toLocaleString('en-GB', {
                                                          day: '2-digit', month: 'short', year: 'numeric',
                                                          hour: '2-digit', minute: '2-digit', hour12: false,
                                                      })
                                                    : 'No activity'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <TierBadge tier={g.planTier} />
                                            <span className="text-fg-muted text-theme-2xs">{g.role} · {g.status}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <p className="text-theme-xs text-fg-muted">
                            Plans are held by groups, not accounts. To change one, open the{' '}
                            <span className="text-brand-600 dark:text-brand-300">Subscriptions</span> tab and search for
                            the group.
                        </p>

                        <button onClick={onClose} className="mt-4 w-full rounded-xl border border-line bg-surface-raised py-2 text-sm text-fg hover:bg-surface-hover">
                            Close
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
