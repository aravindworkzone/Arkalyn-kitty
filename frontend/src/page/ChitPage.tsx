import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  Card,
  DataList,
  Meter,
  Note,
  PageBackground,
  PageContainer,
  PageHeader,
  BackButton,
  StatusBanner,
  Select,
} from "../components/ui";
import type { BadgeTone, MeterTone } from "../components/ui";
import NotFoundPage from "./NotFoundPage";
import { useGetGroupByIdQuery } from "../redux/api/group";
import {
  useGetChitBoardQuery,
  useGetChitHistoryQuery,
  useMarkChitDueMutation,
  useUnmarkChitDueMutation,
  useReleaseChitPayoutMutation,
} from "../redux/api/chit";
import type { ChitDueState, ChitMemberDue, ChitPayoutState } from "../interface/chit";
import { formatRupees } from "../helpers/money";
import { dayLabel } from "../helpers/formatters";
import { getApiErrorMessage } from "../hooks/useApiError";

/**
 * The chit fund page — one page for both audiences.
 *
 * A member sees their own status, what they owe and when, whose turn it is this
 * cycle, their own payout, and their own history. The organiser sees all of that
 * (they are a participant too, and pay like everyone else) plus the per-member
 * roster, the collection total, and the two actions that move money.
 *
 * Not two pages: the organiser is also a participant, so a separate page would
 * either duplicate every member block or strand the organiser's own "did I pay?"
 * somewhere else.
 *
 * The member/organiser split is NOT enforced here. `memberDues` is simply absent
 * from the payload for anyone who cannot manage the chit, and `myHistory` only
 * ever contains the caller's own dues. This file renders what it is given.
 */

const DUE_TONE: Record<ChitDueState, BadgeTone> = {
  PAID: "success",
  PENDING: "warning",
  MISSED: "error",
};

const PAYOUT_TONE: Record<ChitPayoutState, BadgeTone> = {
  RECEIVED: "success",
  CURRENT: "brand",
  UPCOMING: "gray",
};

export default function ChitPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const money = (n: number) => formatRupees(n, i18n.language);

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

  if (groupError) return <NotFoundPage />;

  const scheme = board?.scheme ?? null;
  const cycle = board?.cycle ?? null;
  const canManage = !!scheme?.canManage;
  const memberDues = board?.memberDues;
  const tally = board?.tally;

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
          acknowledgeShortfall: cycle.shortfallAmount > 0 || cycle.collectedAmount < cycle.expectedAmount,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface text-fg">
        <PageBackground />
        <PageContainer width="content">
          <div className="space-y-4 max-w-3xl">
            <div className="h-24 rounded-2xl bg-surface-hover animate-pulse" />
            <div className="h-40 rounded-2xl bg-surface-hover animate-pulse" />
            <div className="h-64 rounded-2xl bg-surface-hover animate-pulse" />
          </div>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />
      <PageContainer width="content">
        <div className="inline-block">
          <BackButton onClick={() => navigate(`/groups/${groupId}`)} />
        </div>

        <PageHeader
          accent="brand"
          icon={
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M12 7a5 5 0 1 1-1.6-3.7M12 1.6V4.4H9.2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
          label={t("chit.label", "Chit")}
          title={group?.name ?? t("chit.title", "Chit fund")}
          description={
            scheme
              ? t("chit.description", {
                  amount: money(scheme.amountPerMember),
                  pot: money(scheme.potPerCycle),
                  count: scheme.participantCount,
                  defaultValue:
                    "{{count}} members paying {{amount}} each cycle — a pot of {{pot}}.",
                })
              : t("chit.descriptionEmpty", "A chit fund for this group.")
          }
        />

        <div className="space-y-4 max-w-3xl">
          <StatusBanner status={msg ? (msg.ok ? "ok" : "err") : null} text={msg?.text ?? ""} />

          {/* ── No scheme, or a scheme not yet running ───────────────────── */}
          {!scheme && (
            <Card title={t("chit.notStartedTitle", "No chit yet")}>
              <p className="text-theme-xs text-fg-muted">
                {canManage || group?.role === "SUPER_ADMIN"
                  ? t(
                      "chit.noSchemeAdmin",
                      "No chit set up yet. Choose the amount, the members and their turn order to begin."
                    )
                  : t(
                      "chit.noSchemeMember",
                      "This group hasn't set up its chit yet. The group owner starts it."
                    )}
              </p>
              {group?.role === "SUPER_ADMIN" && (
                <div className="mt-3">
                  <Button size="sm" onClick={() => navigate(`/groups/${groupId}/chit/setup`)}>
                    {t("chit.setUp", "Set up the chit")}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {scheme?.status === "DRAFT" && (
            <Note tone={canManage ? "warning" : "neutral"}>
              {canManage
                ? t(
                    "chit.draftOrganizer",
                    "This chit is still a draft. Nothing is collected and no turns are fixed until you start it — and starting it locks the amount, the members and the order."
                  )
                : t(
                    "chit.draftMember",
                    "The chit is being set up. You'll see your amount and dates here once it starts."
                  )}
            </Note>
          )}

          {scheme?.status === "DRAFT" && canManage && (
            <Button size="sm" onClick={() => navigate(`/groups/${groupId}/chit/setup`)}>
              {t("chit.continueSetup", "Continue setup")}
            </Button>
          )}

          {scheme?.status === "CANCELLED" && (
            <Note tone="error">
              {t(
                "chit.cancelled",
                "This chit was cancelled. Nothing further is collected — the history below is kept as a record."
              )}
            </Note>
          )}

          {scheme?.status === "COMPLETED" && (
            <Note tone="success">
              {t("chit.completed", {
                total: scheme.totalCycles,
                defaultValue: "This chit is finished. All {{total}} cycles were paid out.",
              })}
            </Note>
          )}

          {/* ── A: my contribution this cycle ────────────────────────────── */}
          {scheme?.status === "ACTIVE" && (
            <Card title={t("chit.myStatusTitle", "Your contribution")}>
              {board?.myDue ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-theme-xl font-semibold text-fg" translate="no">
                        {money(board.myDue.amount)}
                      </p>
                      <p className="text-theme-xs text-fg-muted">
                        {board.myDue.state === "PAID"
                          ? t("chit.paidOn", {
                              n: cycle?.cycleNumber,
                              date: dayLabel(board.myDue.paidAt),
                              defaultValue: "Paid for cycle {{n}} on {{date}}",
                            })
                          : t("chit.dueOn", {
                              n: cycle?.cycleNumber,
                              date: dayLabel(board.myDue.dueDate),
                              defaultValue: "Cycle {{n}} — due {{date}}",
                            })}
                      </p>
                    </div>
                    <Badge tone={DUE_TONE[board.myDue.state]}>
                      {t(`chit.state.${board.myDue.state}`, board.myDue.state)}
                    </Badge>
                  </div>

                  {board.myDue.state === "MISSED" && (
                    <Note tone="error">
                      {t("chit.missedBody", {
                        amount: money(board.myDue.amount),
                        date: dayLabel(board.myDue.dueDate),
                        defaultValue:
                          "{{amount}} was due on {{date}}. Pay the organiser and ask them to record it.",
                      })}
                    </Note>
                  )}

                  {board.myDue.state !== "PAID" && (
                    <Note tone="neutral">
                      {t("chit.offlineHint", {
                        name: scheme.organizer.name,
                        defaultValue: "Pay {{name}} directly — they record it here once received.",
                      })}
                    </Note>
                  )}

                  {board.myArrears && (
                    <Note tone="warning">
                      {t("chit.arrears", {
                        count: board.myArrears.count,
                        amount: money(board.myArrears.amount),
                        defaultValue:
                          "You also have {{count}} unpaid contribution(s) from earlier cycles — {{amount}} in total.",
                      })}
                    </Note>
                  )}
                </div>
              ) : (
                <p className="text-theme-xs text-fg-muted">
                  {t(
                    "chit.notParticipant",
                    "You're not part of this chit, so there's nothing for you to pay. You can still see how it's going."
                  )}
                </p>
              )}
            </Card>
          )}

          {/* ── B: whose turn, and my own payout ─────────────────────────── */}
          {scheme && cycle && (
            <Card
              title={t("chit.turnTitle", "This cycle")}
              headerRight={
                <Badge tone={cycle.status === "PAID" ? "success" : "warning"}>
                  {cycle.status === "PAID"
                    ? t("chit.cyclePaid", "Paid out")
                    : t("chit.cycleCollecting", "Collecting")}
                </Badge>
              }
            >
              <div className="space-y-3">
                <div>
                  <p className="text-theme-sm text-fg">
                    {t("chit.turnThisCycle", {
                      n: cycle.cycleNumber,
                      total: scheme.totalCycles,
                      name: cycle.recipient.isMe
                        ? t("chit.youLower", "you")
                        : cycle.recipient.name,
                      defaultValue: "Cycle {{n}} of {{total}} goes to {{name}}",
                    })}
                  </p>
                  <p className="text-theme-xs text-fg-muted" translate="no">
                    {t("chit.potIs", { amount: money(cycle.expectedAmount), defaultValue: "Pot: {{amount}}" })}
                  </p>
                </div>

                <div>
                  <Meter
                    value={cycle.collectedPct}
                    tone={
                      (cycle.collectedPct >= 100
                        ? "success"
                        : cycle.overdue
                          ? "error"
                          : "brand") as MeterTone
                    }
                    ariaLabel={t("chit.collectedAria", "Collected so far this cycle")}
                  />
                  <p className="text-theme-2xs text-fg-muted mt-1" translate="no">
                    {t("chit.collectedOf", {
                      collected: money(cycle.collectedAmount),
                      expected: money(cycle.expectedAmount),
                      defaultValue: "{{collected}} of {{expected}} collected",
                    })}
                  </p>
                </div>

                {board?.myPayout && (
                  <div className="pt-2 border-t border-line flex items-start justify-between gap-3">
                    <p className="text-theme-xs text-fg-muted">
                      {board.myPayout.state === "RECEIVED"
                        ? t("chit.payoutReceived", {
                            amount: money(board.myPayout.receivedAmount ?? 0),
                            date: dayLabel(board.myPayout.receivedOn),
                            n: board.myPayout.cycleNumber,
                            defaultValue: "You received {{amount}} on {{date}} — cycle {{n}}.",
                          })
                        : board.myPayout.state === "CURRENT"
                          ? t("chit.payoutNow", {
                              amount: money(board.myPayout.expectedAmount),
                              defaultValue:
                                "It's your turn. You get {{amount}} once this cycle is released.",
                            })
                          : t("chit.payoutUpcoming", {
                              n: board.myPayout.cycleNumber,
                              date: dayLabel(board.myPayout.expectedOn),
                              defaultValue: "Your turn is cycle {{n}}, expected around {{date}}.",
                            })}
                    </p>
                    <Badge tone={PAYOUT_TONE[board.myPayout.state]}>
                      {t(`chit.payoutState.${board.myPayout.state}`, board.myPayout.state)}
                    </Badge>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* ── C: the organiser's collection panel ──────────────────────── */}
          {canManage && scheme?.status === "ACTIVE" && cycle && memberDues && (
            <Card
              title={t("chit.collectionTitle", {
                n: cycle.cycleNumber,
                defaultValue: "Collection — cycle {{n}}",
              })}
              headerRight={
                tally ? (
                  <Badge tone="brand">
                    {tally.paid}/{tally.total}
                  </Badge>
                ) : undefined
              }
            >
              <div className="space-y-3">
                {scheme.totalCycles > 1 && (
                  <Select
                    value={String(cycle.cycleNumber)}
                    onChange={(v) => selectCycle(Number(v))}
                    options={Array.from({ length: scheme.totalCycles }, (_, i) => ({
                      value: String(i + 1),
                      label: t("chit.cycleN", { n: i + 1, defaultValue: "Cycle {{n}}" }),
                      description: board?.turns.find((turn) => turn.cycleNumber === i + 1)?.name,
                    }))}
                    name="chit-cycle"
                  />
                )}

                <div className="divide-y divide-line">
                  {memberDues.map((due) => (
                    <div
                      key={due.dueId}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-theme-sm text-fg truncate" translate="no">
                          <span className="font-mono text-fg-muted mr-1.5">#{due.position}</span>
                          {due.name}
                          {due.isMe && (
                            <span className="text-fg-muted"> · {t("chit.you", "You")}</span>
                          )}
                        </p>
                        <p className="text-theme-2xs text-fg-muted" translate="no">
                          {money(due.amount)}
                          {due.paidAt ? ` · ${dayLabel(due.paidAt)}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge tone={DUE_TONE[due.state]}>
                          {t(`chit.state.${due.state}`, due.state)}
                        </Badge>
                        {due.state === "PAID" ? (
                          cycle.status === "COLLECTING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={pendingDueId === due.dueId}
                              disabled={!!pendingDueId && pendingDueId !== due.dueId}
                              onClick={() => onUnmark(due)}
                            >
                              {t("chit.undo", "Undo")}
                            </Button>
                          )
                        ) : (
                          <Button
                            size="sm"
                            loading={pendingDueId === due.dueId}
                            disabled={!!pendingDueId && pendingDueId !== due.dueId}
                            onClick={() => onMark(due)}
                          >
                            {t("chit.markPaid", "Mark paid")}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Release, with a confirmation that names the real numbers.
                    Inline rather than a modal — a modal would cover the very
                    figures being confirmed. */}
                {cycle.status === "COLLECTING" && cycle.isCurrent && (
                  <div className="pt-3 border-t border-line">
                    {confirmingPayout ? (
                      <div className="space-y-2">
                        <p className="text-theme-sm text-fg">
                          {t("chit.confirmRecipient", {
                            name: cycle.recipient.name,
                            amount: money(
                              cycle.collectedAmount < cycle.expectedAmount
                                ? cycle.collectedAmount
                                : cycle.expectedAmount
                            ),
                            defaultValue: "{{name}} receives {{amount}}",
                          })}
                        </p>
                        {cycle.collectedAmount < cycle.expectedAmount && (
                          <Note tone="warning">
                            {t("chit.shortWarning", {
                              count: tally?.total ? tally.total - tally.paid : 0,
                              short: money(cycle.expectedAmount - cycle.collectedAmount),
                              collected: money(cycle.collectedAmount),
                              expected: money(cycle.expectedAmount),
                              defaultValue:
                                "{{count}} member(s) haven't paid, so this cycle is {{short}} short. They will receive {{collected}}, not the full {{expected}}. The unpaid contributions stay owed.",
                            })}
                          </Note>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" loading={isReleasing} onClick={onRelease}>
                            {t("chit.confirmRelease", "Release payout")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmingPayout(false)}
                          >
                            {t("chit.cancel", "Cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setConfirmingPayout(true)}>
                        {t("chit.releasePayout", "Release this cycle's payout")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* ── D: the turn order, public ────────────────────────────────── */}
          {scheme && board && board.turns.length > 0 && (
            <Card
              title={t("chit.orderTitle", "Turn order")}
              headerRight={
                <span className="text-theme-2xs text-fg-muted">
                  {t("chit.orderSummary", {
                    done: scheme.cyclesPaid,
                    total: scheme.totalCycles,
                    defaultValue: "{{done}} of {{total}} paid out",
                  })}
                </span>
              }
            >
              <div className="divide-y divide-line">
                {board.turns.map((turn) => (
                  <div
                    key={turn.position}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <p className="text-theme-sm text-fg truncate" translate="no">
                      <span className="font-mono text-fg-muted mr-1.5">#{turn.position}</span>
                      {turn.name}
                      {turn.isMe && <span className="text-fg-muted"> · {t("chit.you", "You")}</span>}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-theme-2xs text-fg-muted" translate="no">
                        {turn.receivedOn
                          ? dayLabel(turn.receivedOn)
                          : t("chit.expectedOn", {
                              date: dayLabel(turn.expectedOn),
                              defaultValue: "Expected {{date}}",
                            })}
                      </span>
                      <Badge tone={PAYOUT_TONE[turn.payoutState]}>
                        {t(`chit.payoutState.${turn.payoutState}`, turn.payoutState)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── E: cycle history ─────────────────────────────────────────── */}
          {scheme && (
            <Card title={t("chit.historyTitle", "Cycle history")} padded={false}>
              <DataList
                isLoading={historyFetching && !history}
                isEmpty={!history?.items.length}
                emptyLabel={t("chit.historyEmpty", "No cycles have been paid out yet.")}
                divided
                pagination={
                  history && history.total > history.limit
                    ? {
                        page: historyPage,
                        totalPages: Math.max(1, Math.ceil(history.total / history.limit)),
                        total: history.total,
                        unitLabel: t("chit.cyclesUnit", "cycles"),
                        onPageChange: setHistoryPage,
                        busy: historyFetching,
                      }
                    : undefined
                }
              >
                {history?.items.map((row) => (
                  <div
                    key={row.cycleId}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-theme-sm text-fg truncate" translate="no">
                        {row.status === "PAID"
                          ? t("chit.historyLine", {
                              n: row.cycleNumber,
                              name: row.recipient.isMe
                                ? t("chit.youLower", "you")
                                : row.recipient.name,
                              amount: money(row.payoutAmount),
                              defaultValue: "Cycle {{n}} → {{name}} got {{amount}}",
                            })
                          : t("chit.historyOpen", {
                              n: row.cycleNumber,
                              name: row.recipient.name,
                              defaultValue: "Cycle {{n}} → {{name}}",
                            })}
                      </p>
                      <p className="text-theme-2xs text-fg-muted" translate="no">
                        {row.status === "PAID"
                          ? dayLabel(row.paidAt)
                          : t("chit.notReleasedYet", "Not released yet")}
                        {row.shortfallAmount > 0 &&
                          ` · ${t("chit.shortBy", {
                            amount: money(row.shortfallAmount),
                            defaultValue: "{{amount}} short",
                          })}`}
                      </p>
                    </div>
                    {row.myDue && (
                      <Badge tone={DUE_TONE[row.myDue.state]}>
                        {t(`chit.youState.${row.myDue.state}`, `You: ${row.myDue.state}`)}
                      </Badge>
                    )}
                  </div>
                ))}
              </DataList>
            </Card>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
