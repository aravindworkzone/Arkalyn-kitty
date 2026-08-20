import { useTranslation } from "react-i18next";
import { Badge, Card, Meter } from "../ui";
import type { MeterTone } from "../ui";
import type { ChitBoardCtx } from "../../hooks/useChitBoard";
import { formatRupees } from "../../helpers/money";
import { dayLabel } from "../../helpers/formatters";
import { PAYOUT_TONE } from "./chitTones";

/**
 * Whose turn the current cycle is, the pot, and the caller's own payout.
 *
 * The collection meter inside is gated on canViewAll: how collection is GOING is
 * the organiser's figure, while whose turn it is and what the pot holds are the
 * terms every member agreed to.
 *
 * Sliced out of the former single-page ChitPage. It takes the whole board
 * context rather than a hand-picked prop list: the panels move between pages as
 * the layout is reworked, and a bespoke prop signature per panel would have to be
 * rewritten every time one did.
 */
export default function ThisCyclePanel({ ctx }: { ctx: ChitBoardCtx }) {
  const { t, i18n } = useTranslation();
  const money = (n: number) => formatRupees(n, i18n.language);
  const { board, cycle, scheme, canViewAll } = ctx;

  return (
    <>
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

                {/* How collection is going across the whole group. Shown only to
                    whoever is answerable for it — a member watches their own due
                    and the rotation, not everyone else's arrears. */}
                {canViewAll && cycle.collectedPct !== undefined && (
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
                        collected: money(cycle.collectedAmount ?? 0),
                        expected: money(cycle.expectedAmount),
                        defaultValue: "{{collected}} of {{expected}} collected",
                      })}
                    </p>
                  </div>
                )}

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

    </>
  );
}
