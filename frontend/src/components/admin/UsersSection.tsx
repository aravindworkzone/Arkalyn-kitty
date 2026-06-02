import { useState } from 'react';
import {
    useGetAdminUsersQuery,
    useSuspendUserMutation,
    useRestoreUserMutation,
    useDeleteAdminUserMutation,
    useHardDeleteAdminUserMutation,
} from '../../redux/api/admin';
import { StatusBadge, TierBadge } from './adminUi';
import UserDetailModal from './UserDetailModal';
import DeleteConfirmModal from '../deleteModel';
import { getApiErrorMessage } from '../../hooks/useApiError';
import type { UserStatus } from '../../interface/admin';
import type { PlanTier } from '../../interface/subscription';

const LIMIT = 20;
const selectClass =
    'bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-violet-500/40 [&>option]:bg-[#0d1320]';

export default function UsersSection() {
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
    const [planFilter, setPlanFilter] = useState<PlanTier | ''>('');
    const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
    const [selected, setSelected] = useState<string | null>(null);

    const { data, isLoading, isFetching } = useGetAdminUsersQuery({
        page,
        limit: LIMIT,
        search: search || undefined,
        status: statusFilter || undefined,
        plan: planFilter || undefined,
        sort,
    });
    const [suspend] = useSuspendUserMutation();
    const [restore] = useRestoreUserMutation();
    const [deleteUser] = useDeleteAdminUserMutation();
    const [hardDeleteUser] = useHardDeleteAdminUserMutation();

    // Tracks the row whose suspend/restore is in flight so just that button shows
    // a pending state (the mutation hooks' isLoading is shared across all rows).
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

    const submitSearch = () => {
        setPage(1);
        setSearch(searchInput.trim());
    };

    // Changing a filter resets to page 1 so the user never lands on an empty page.
    const onFilterChange = <T,>(setter: (v: T) => void) => (v: T) => {
        setPage(1);
        setter(v);
    };

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
                    className="flex-1 min-w-[180px] bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/40"
                />
                <button onClick={submitSearch} className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-violet-500/80 border border-violet-500/50 text-white hover:bg-violet-500">
                    Search
                </button>
                <select
                    value={statusFilter}
                    onChange={(e) => onFilterChange(setStatusFilter)(e.target.value as UserStatus | '')}
                    className={selectClass}
                    aria-label="Filter by status"
                >
                    <option value="">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="DELETED">Deleted</option>
                </select>
                <select
                    value={planFilter}
                    onChange={(e) => onFilterChange(setPlanFilter)(e.target.value as PlanTier | '')}
                    className={selectClass}
                    aria-label="Filter by plan"
                >
                    <option value="">All plans</option>
                    <option value="FREE">Free</option>
                    <option value="PRO">Pro</option>
                    <option value="PREMIUM">Premium</option>
                </select>
                <select
                    value={sort}
                    onChange={(e) => onFilterChange(setSort)(e.target.value as 'newest' | 'oldest')}
                    className={selectClass}
                    aria-label="Sort order"
                >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                </select>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">
                {isLoading ? (
                    <div className="p-6 text-white/30 text-sm">Loading…</div>
                ) : items.length === 0 ? (
                    <div className="p-6 text-white/30 text-sm">No users found.</div>
                ) : (
                    items.map((u) => (
                        <div key={u._id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.05] last:border-0">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[13px] text-white/85 truncate">{u.name}</span>
                                    {u.role === 'APP_OWNER' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 font-bold">OWNER</span>}
                                </div>
                                <p className="text-[11px] text-white/35 truncate">{u.email}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <TierBadge tier={u.effectiveTier} />
                                <StatusBadge status={u.status} />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => setSelected(u._id)} className="text-[11px] text-violet-300 hover:text-violet-200">Manage</button>
                                {u.role !== 'APP_OWNER' && u.status === 'ACTIVE' && (
                                    <button
                                        onClick={() => runRowAction(u._id, suspend)}
                                        disabled={actingId === u._id}
                                        className="text-[11px] text-amber-300/80 hover:text-amber-300 disabled:opacity-40 transition-opacity"
                                    >
                                        {actingId === u._id ? 'Suspending…' : 'Suspend'}
                                    </button>
                                )}
                                {u.role !== 'APP_OWNER' && u.status === 'SUSPENDED' && (
                                    <button
                                        onClick={() => runRowAction(u._id, restore)}
                                        disabled={actingId === u._id}
                                        className="text-[11px] text-emerald-300/80 hover:text-emerald-300 disabled:opacity-40 transition-opacity"
                                    >
                                        {actingId === u._id ? 'Restoring…' : 'Restore'}
                                    </button>
                                )}
                                {u.role !== 'APP_OWNER' && u.status !== 'DELETED' && (
                                    <button
                                        onClick={() => setConfirmTarget({ id: u._id, name: u.name, mode: 'soft' })}
                                        className="text-[11px] text-red-300/80 hover:text-red-300"
                                    >
                                        Delete
                                    </button>
                                )}
                                {u.role !== 'APP_OWNER' && (
                                    <button
                                        onClick={() => setConfirmTarget({ id: u._id, name: u.name, mode: 'hard' })}
                                        title="Permanently erase this account"
                                        className="text-[11px] font-semibold text-red-400 hover:text-red-300"
                                    >
                                        Hard delete
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="flex items-center justify-between text-[12px] text-white/40">
                <span>{total} users</span>
                <div className="flex items-center gap-3">
                    <button disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30 hover:text-white/70">← Prev</button>
                    <span>Page {page} / {totalPages}</span>
                    <button disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30 hover:text-white/70">Next →</button>
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
                <p className="text-[12px] leading-relaxed text-white/40">
                    {confirmTarget?.mode === 'hard' ? (
                        <>
                            This permanently erases <span className="text-white/70 font-medium">{confirmTarget?.name}</span> —
                            account, sessions, memberships, invites, notifications and payment records. Group history is kept.
                        </>
                    ) : (
                        <>
                            This soft-deletes <span className="text-white/70 font-medium">{confirmTarget?.name}</span>'s account.
                            They're logged out immediately and blocked from signing in (reversible by restoring).
                        </>
                    )}
                </p>
            </DeleteConfirmModal>
        </div>
    );
}
