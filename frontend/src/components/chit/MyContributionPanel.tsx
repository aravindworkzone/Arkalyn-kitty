import { useTranslation } from "react-i18next";
import { Badge, Card, Note } from "../ui";
import type { ChitBoardCtx } from "../../hooks/useChitBoard";
import { formatRupees } from "../../helpers/money";
import { dayLabel } from "../../helpers/formatters";
import { DUE_TONE } from "./chitTones";

/**
 * What the caller owes this cycle, and whether it is paid, pending or missed.
 *
 * The only panel that is purely about ONE person. `board.myDue` is resolved
 * server-side and only ever holds the caller's own due — there is no filtering
 * to get wrong here.
 *
 * Sliced out of the former single-page ChitPage. It takes the whole board
 * context rather than a hand-picked prop list: the panels move between pages as
 * the layout is reworked, and a bespoke prop signature per panel would have to be
 * rewritten every time one did.
 */
export default function MyContributionPanel({ ctx }: { ctx: ChitBoardCtx }) {
  const { t, i18n } = useTranslation();
  const money = (n: number) => formatRupees(n, i18n.language);
  const { board, cycle, scheme } = ctx;

  return (
    <>
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

    </>
  );
}
