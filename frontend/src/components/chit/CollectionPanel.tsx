import { useTranslation } from "react-i18next";
import { Badge, Button, Card, Note, Select } from "../ui";
import type { ChitBoardCtx } from "../../hooks/useChitBoard";
import { formatRupees } from "../../helpers/money";
import { dayLabel } from "../../helpers/formatters";
import { DUE_TONE } from "./chitTones";

/**
 * The per-member roster for one cycle, and the two actions that move money.
 *
 * Rendered for canViewAll, but every button inside is gated on canManage — an
 * admin who is not the organiser reads the roster and cannot act on it, because
 * requireChitOrganizer would refuse them.
 *
 * Sliced out of the former single-page ChitPage. It takes the whole board
 * context rather than a hand-picked prop list: the panels move between pages as
 * the layout is reworked, and a bespoke prop signature per panel would have to be
 * rewritten every time one did.
 */
export default function CollectionPanel({ ctx }: { ctx: ChitBoardCtx }) {
  const { t, i18n } = useTranslation();
  const money = (n: number) => formatRupees(n, i18n.language);
  const { board, cycle, scheme, canViewAll, canManage, memberDues, tally, onMark, onUnmark, onRelease, pendingDueId, confirmingPayout, setConfirmingPayout, isReleasing, selectCycle } = ctx;

  return (
    <>
          {/* ── C: the organiser's collection panel ──────────────────────── */}
          {/* Visible to anyone with the wide read — an admin may watch collection
              without being the one who records it. The mark/undo buttons inside
              stay behind canManage, so this renders read-only for them rather
              than offering an action the API would refuse. */}
          {canViewAll && scheme?.status === "ACTIVE" && cycle && memberDues && (
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
                        {canManage &&
                          (due.state === "PAID" ? (
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
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Release, with a confirmation that names the real numbers.
                    Inline rather than a modal — a modal would cover the very
                    figures being confirmed.
                    
                    canManage, not canViewAll: releasing the pot is the one action
                    that moves money, and requireChitOrganizer refuses it for an
                    admin who is not the organiser. */}
                {canManage && cycle.status === "COLLECTING" && cycle.isCurrent && (
                  <div className="pt-3 border-t border-line">
                    {confirmingPayout ? (
                      <div className="space-y-2">
                        <p className="text-theme-sm text-fg">
                          {t("chit.confirmRecipient", {
                            name: cycle.recipient.name,
                            // Behind canManage, which implies canViewAll, so
                            // collectedAmount is on the payload. Falls back to the
                            // full pot rather than 0, so a narrowed response could
                            // never render "receives nothing".
                            amount: money(
                              (cycle.collectedAmount ?? cycle.expectedAmount) < cycle.expectedAmount
                                ? cycle.collectedAmount ?? cycle.expectedAmount
                                : cycle.expectedAmount
                            ),
                            defaultValue: "{{name}} receives {{amount}}",
                          })}
                        </p>
                        {(cycle.collectedAmount ?? cycle.expectedAmount) < cycle.expectedAmount && (
                          <Note tone="warning">
                            {t("chit.shortWarning", {
                              count: tally?.total ? tally.total - tally.paid : 0,
                              short: money(cycle.expectedAmount - (cycle.collectedAmount ?? 0)),
                              collected: money(cycle.collectedAmount ?? 0),
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

    </>
  );
}
