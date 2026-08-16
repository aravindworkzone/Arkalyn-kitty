import { useState, useEffect, useRef } from 'react';
import {
    useGetAdminUsersQuery,
    useSuspendUserMutation,
    useRestoreUserMutation,
    useDeleteAdminUserMutation,
    useHardDeleteAdminUserMutation,
} from '../../redux/api/admin';
import { StatusBadge } from './adminUi';
import UserDetailModal from './UserDetailModal';
import DeleteConfirmModal from '../deleteModel';
import { getApiErrorMessage } from '../../hooks/useApiError';
import type { UserStatus } from '../../interface/admin';

const LIMIT = 20;
const selectClass =
    'bg-surface-hover border border-line rounded-xl px-3 py-2.5 text-sm text-fg outline-none focus:border-brand-200 dark:border-brand-500/40 [&>option]:bg-surface-overlay';

function ThreeDotsMenu({
    userId,
    userName,
    userStatus,
    actingId,
    onSuspend,
    onRestore,
    onDelete,
    onHardDelete,
}: {
    userId: string;
    userName: string;
    userStatus: UserStatus;
    actingId: string | null;
    onSuspend: () => void;
    onRestore: () => void;
    onDelete: () => void;
    onHardDelete: () => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const acting = actingId === userId;

    return (
        <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={() => setOpen((v) => !v)}
                disabled={acting}
                aria-label="User actions"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover active:bg-surface-hover transition-colors disabled:opacity-40"
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <circle cx="7" cy="2.5" r="1.1" />
                    <circle cx="7" cy="7" r="1.1" />
                    <circle cx="7" cy="11.5" r="1.1" />
                </svg>
            </button>

            {open && (
                <div className="absolute right-0 top-8 z-dropdown w-44 rounded-xl border border-line bg-surface-overlay shadow-theme-md py-1 text-theme-xs">
                    {userStatus === 'ACTIVE' && (
                        <button
                            onClick={() => { setOpen(false); onSuspend(); }}
                            className="w-full text-left px-3.5 py-2 text-warning-700 dark:text-warning-300 hover:bg-surface-hover hover:text-warning-700 dark:text-warning-300 transition-colors"
                        >
                            Suspend
                        </button>
                    )}
                    {userStatus === 'SUSPENDED' && (
                        <button
                            onClick={() => { setOpen(false); onRestore(); }}
                            className="w-full text-left px-3.5 py-2 text-success-700 dark:text-success-300 hover:bg-surface-hover hover:text-success-700 dark:text-success-300 transition-colors"
                        >
                            Restore
                        </button>
                    )}
                    {userStatus !== 'DELETED' && (
                        <button
                            onClick={() => { setOpen(false); onDelete(); }}
                            className="w-full text-left px-3.5 py-2 text-error-600 dark:text-error-400 hover:bg-surface-hover hover:text-error-600 dark:text-error-400 transition-colors"
                        >
                            Delete
                        </button>
                    )}
                    <button
                        onClick={() => { setOpen(false); onHardDelete(); }}
                        className="w-full text-left px-3.5 py-2 text-error-600 dark:text-error-400 font-semibold hover:bg-surface-hover hover:text-error-600 dark:text-error-400 transition-colors"
                    >
                        Hard delete
                    </button>
                </div>
            )}
        </div>
    );
}

export default function UsersSection() {
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
    const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
    const [selected, setSelected] = useState<string | null>(null);

    const { data, isLoading, isFetching } = useGetAdminUsersQuery({
        page,
        limit: LIMIT,
        search: search || undefined,
        status: statusFilter || undefined,
        sort,
    });
    const [suspend] = useSuspendUserMutation();
    const [restore] = useRestoreUserMutation();
    const [deleteUser] = useDeleteAdminUserMutation();
    const [hardDeleteUser] = useHardDeleteAdminUserMutation();

    const [actingId, setActingId] = useState<string | null>(null);
    const runRowAction = async (id: string, action: (id: string) => { unwrap: () => Promise<unknown> }) => {
        setActingId(id);
        try { await action(id).unwrap(); } finally { setActingId(null); }
    };

    const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; mode: 'soft' | 'hard' } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [opError, setOpError] = useState('');

    const closeConfirm = () => { setConfirmTarget(null); setOpError(''); };

    const handleConfirmDelete = async () => {
        if (!confirmTarget) return;
        setDeleting(true);
        setOpError('');
        try {
            if (confirmTarget.mode === 'hard') await hardDeleteUser(confirmTarget.id).unwrap();
            else await deleteUser(confirmTarget.id).unwrap();
            closeConfirm();
        } catch (e) {
            setOpError(getApiErrorMessage(e, 'Operation failed. Try again.'));
        } finally {
            setDeleting(false);
        }
    };

    const submitSearch = () => { setPage(1); setSearch(searchInput.trim()); };
    const onFilterChange = <T,>(setter: (v: T) => void) => (v: T) => { setPage(1); setter(v); };

    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / LIMIT));
    const items = data?.items ?? [];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                    placeholder="Search by name or email…"
                    className="flex-1 min-w-[180px] bg-surface-hover border border-line rounded-xl px-4 py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-brand-200 dark:border-brand-500/40"
                />
                <button onClick={submitSearch} className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-brand-50 dark:bg-brand-500/80 border border-brand-200 dark:border-brand-500/50 text-fg hover:bg-brand-500">
                    Search
                </button>
                <select value={statusFilter} onChange={(e) => onFilterChange(setStatusFilter)(e.target.value as UserStatus | '')} className={selectClass} aria-label="Filter by status">
                    <option value="">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="DELETED">Deleted</option>
                </select>
                <select value={sort} onChange={(e) => onFilterChange(setSort)(e.target.value as 'newest' | 'oldest')} className={selectClass} aria-label="Sort order">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                </select>
            </div>

            <div className="rounded-2xl border border-line bg-surface-raised overflow-hidden">
                {isLoading ? (
                    <div className="p-6 text-fg-muted text-sm">Loading…</div>
                ) : items.length === 0 ? (
                    <div className="p-6 text-fg-muted text-sm">No users found.</div>
                ) : (
                    items.map((u) => (
                        <div
                            key={u._id}
                            onClick={() => setSelected(u._id)}
                            className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer hover:bg-surface-raised active:bg-surface-hover transition-colors"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-theme-sm text-fg truncate">{u.name}</span>
                                    {u.role === 'APP_OWNER' && (
                                        <span className="text-theme-2xs px-1.5 py-0.5 rounded bg-warning-50 dark:bg-warning-500/15 text-warning-700 dark:text-warning-300 font-bold shrink-0">OWNER</span>
                                    )}
                                </div>
                                <p className="text-theme-xs text-fg-muted truncate">{u.email}</p>
                                {u.lastLoginAt && (
                                    <p className="text-theme-2xs text-fg-muted mt-0.5">
                                        Last login: {new Date(u.lastLoginAt).toLocaleString('en-IN', {
                                            day: '2-digit', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit', hour12: true,
                                        })}
                                    </p>
                                )}
                            </div>

                            {/* No tier badge: accounts hold no plan. Tiers are
                                listed per group under Subscriptions. */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <StatusBadge status={u.status} />
                            </div>

                            {u.role !== 'APP_OWNER' ? (
                                <ThreeDotsMenu
                                    userId={u._id}
                                    userName={u.name}
                                    userStatus={u.status}
                                    actingId={actingId}
                                    onSuspend={() => runRowAction(u._id, suspend)}
                                    onRestore={() => runRowAction(u._id, restore)}
                                    onDelete={() => setConfirmTarget({ id: u._id, name: u.name, mode: 'soft' })}
                                    onHardDelete={() => setConfirmTarget({ id: u._id, name: u.name, mode: 'hard' })}
                                />
                            ) : (
                                <div className="w-7" />
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="flex items-center justify-between text-theme-xs text-fg-muted">
                <span>{total} users</span>
                <div className="flex items-center gap-3">
                    <button disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30 hover:text-fg">← Prev</button>
                    <span>Page {page} / {totalPages}</span>
                    <button disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30 hover:text-fg">Next →</button>
                </div>
            </div>

            {selected && <UserDetailModal userId={selected} onClose={() => setSelected(null)} />}

            <DeleteConfirmModal
                isOpen={!!confirmTarget}
                onClose={closeConfirm}
                onConfirm={handleConfirmDelete}
                label={confirmTarget?.mode === 'hard' ? 'Permanently delete user' : 'Delete user'}
                isLoading={deleting}
                error={opError}
            >
                <p className="text-theme-xs leading-relaxed text-fg-muted">
                    {confirmTarget?.mode === 'hard' ? (
                        <>This permanently erases <span className="text-fg font-medium">{confirmTarget?.name}</span> — account, sessions, memberships, invites, notifications and payment records. Group history is kept.</>
                    ) : (
                        <>This soft-deletes <span className="text-fg font-medium">{confirmTarget?.name}</span>'s account. They're logged out immediately and blocked from signing in (reversible by restoring).</>
                    )}
                </p>
            </DeleteConfirmModal>
        </div>
    );
}
