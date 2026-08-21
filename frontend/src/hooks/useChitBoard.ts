import { useState } from "react";
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGetGroupByIdQuery } from "../redux/api/group";
import {
  useGetChitBoardQuery,
  useGetChitHistoryQuery,
  useMarkChitDueMutation,
  useUnmarkChitDueMutation,
  useReleaseChitPayoutMutation,
} from "../redux/api/chit";
import type { ChitMemberDue } from "../interface/chit";
import { getApiErrorMessage } from "./useApiError";

/**
 * Everything the chit board's three pages read and act on, resolved once.
 *
 * The board moved from one page to three (`/chit`, `/chit/cycles`,
 * `/chit/collection`) and they are NOT independent: the organiser's actions live
 * on Collection but their result banner belongs to the shell above all three, and
 * `?cycle=` selected on Collection also decides which cycle My chit describes.
 * Resolving that in one hook, held by the layout and handed down through the
 * router's outlet context, is what keeps the three from each owning a different
 * answer.
 *
 * Called ONCE, by ChitLayout. A page calling it again would get its own `msg` and
 * `pendingDueId` — the queries would dedupe, but the local state would not, and
 * the banner would fire on a component nobody is looking at.
 */
export function useChitBoard() {
  const { groupId } = useParams();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Which cycle the board describes. Owned by the Collection page's selector but
  // read by all three, which is why it lives in the URL rather than in state.
  const cycleParam = Number(searchParams.get("cycle")) || undefined;

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [confirmingPayout, setConfirmingPayout] = useState(false);
  // Which row is mid-request. One id, not a map: only one row can be in flight,
  // and every other row is disabled while it is — so a shared `isLoading` flag
  // (which would spin every row at once) is never consulted.
  const [pendingDueId, setPendingDueId] = useState<string | null>(null);

  const { data: group, isError: groupError } = useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const { data: board, isLoading } = useGetChitBoardQuery(
    { groupId: groupId!, cycle: cycleParam },
    { skip: !groupId }
  );
  const { data: history, isFetching: historyFetching } = useGetChitHistoryQuery(
    { groupId: groupId!, page: historyPage, limit: 10 },
    { skip: !groupId }
  );

  const [markDue] = useMarkChitDueMutation();
  const [unmarkDue] = useUnmarkChitDueMutation();
  const [releasePayout, { isLoading: isReleasing }] = useReleaseChitPayoutMutation();

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      return true;
    } catch (err) {
      setMsg({
        ok: false,
        text: getApiErrorMessage(err, t("chit.actionFailed", "That didn't work. Try again.")),
      });
      return false;
    }
  };

  const scheme = board?.scheme ?? null;
  const cycle = board?.cycle ?? null;
  const canManage = !!scheme?.canManage;
  // Wider than canManage: an ADMIN reads the group's figures but does not record
  // payments. A plain MEMBER sees only their own dues, the turn order and who has
  // been paid — the collection meter and the roster are not theirs to watch.
  const canViewAll = !!scheme?.canViewAll;

  const onMark = async (due: ChitMemberDue) => {
    setPendingDueId(due.dueId);
    try {
      await run(
        () => markDue({ groupId: groupId!, dueId: due.dueId }).unwrap(),
        t("chit.recorded", "Contribution recorded.")
      );
    } finally {
      setPendingDueId(null);
    }
  };

  const onUnmark = async (due: ChitMemberDue) => {
    setPendingDueId(due.dueId);
    try {
      await run(
        () => unmarkDue({ groupId: groupId!, dueId: due.dueId }).unwrap(),
        t("chit.undone", "Contribution undone.")
      );
    } finally {
      setPendingDueId(null);
    }
  };

  const onRelease = async () => {
    if (!cycle) return;
    const ok = await run(
      () =>
        releasePayout({
          groupId: groupId!,
          cycleId: cycle.cycleId,
          // Only ever reached behind canManage, which implies canViewAll, so both
          // figures are on the payload — defaulted rather than asserted so a
          // narrowed response can never send a silent `undefined > 0`.
          acknowledgeShortfall:
            (cycle.shortfallAmount ?? 0) > 0 ||
            (cycle.collectedAmount ?? cycle.expectedAmount) < cycle.expectedAmount,
        }).unwrap(),
      t("chit.released", "Payout recorded.")
    );
    if (ok) setConfirmingPayout(false);
  };

  const selectCycle = (n: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("cycle", String(n));
    setSearchParams(next, { replace: true });
  };

  return {
    groupId,
    group,
    groupError,
    board,
    isLoading,
    scheme,
    cycle,
    canManage,
    canViewAll,
    memberDues: board?.memberDues,
    tally: board?.tally,
    history,
    historyPage,
    setHistoryPage,
    historyFetching,
    msg,
    onMark,
    onUnmark,
    onRelease,
    pendingDueId,
    confirmingPayout,
    setConfirmingPayout,
    isReleasing,
    selectCycle,
  };
}

/** What ChitLayout hands to each page through the router's outlet context. */
export type ChitBoardCtx = ReturnType<typeof useChitBoard>;

/**
 * How each chit page reaches the board ChitLayout resolved.
 *
 * Lives here rather than in ChitLayout so that file exports only its component —
 * a mixed export breaks Fast Refresh, which is the rule ManagementTabs is already
 * flagged for.
 */
export const useChitCtx = () => useOutletContext<ChitBoardCtx>();
