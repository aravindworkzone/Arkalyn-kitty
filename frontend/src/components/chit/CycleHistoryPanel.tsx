import { useTranslation } from "react-i18next";
import { Badge, Card, DataList } from "../ui";
import type { ChitBoardCtx } from "../../hooks/useChitBoard";
import { formatRupees } from "../../helpers/money";
import { dayLabel } from "../../helpers/formatters";
import { DUE_TONE } from "./chitTones";

/**
 * One row per cycle: who received the pot and when, plus the caller's own
 * paid/missed marker for that cycle — never anyone else's.
 *
 * Sliced out of the former single-page ChitPage. It takes the whole board
 * context rather than a hand-picked prop list: the panels move between pages as
 * the layout is reworked, and a bespoke prop signature per panel would have to be
 * rewritten every time one did.
 */
export default function CycleHistoryPanel({ ctx }: { ctx: ChitBoardCtx }) {
  const { t, i18n } = useTranslation();
  const money = (n: number) => formatRupees(n, i18n.language);
  const { scheme, canViewAll, history, historyPage, setHistoryPage, historyFetching } = ctx;

  return (
    <>
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
                        {/* How far short the collection fell is the organiser's
                            figure. A member already sees what the recipient
                            actually received, which is the part that concerns
                            them. */}
                        {canViewAll &&
                          (row.shortfallAmount ?? 0) > 0 &&
                          ` · ${t("chit.shortBy", {
                            amount: money(row.shortfallAmount ?? 0),
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
    </>
  );
}
