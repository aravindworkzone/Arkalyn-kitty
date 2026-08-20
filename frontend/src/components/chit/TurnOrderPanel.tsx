import { useTranslation } from "react-i18next";
import { Badge, Card } from "../ui";
import type { ChitBoardCtx } from "../../hooks/useChitBoard";
import { dayLabel } from "../../helpers/formatters";
import { PAYOUT_TONE } from "./chitTones";

/**
 * The rotation: who has been paid, whose turn it is, who is still waiting.
 *
 * Public to every member. `turns` carries no payment fields at all, so there is
 * nothing here to leak.
 *
 * Sliced out of the former single-page ChitPage. It takes the whole board
 * context rather than a hand-picked prop list: the panels move between pages as
 * the layout is reworked, and a bespoke prop signature per panel would have to be
 * rewritten every time one did.
 */
export default function TurnOrderPanel({ ctx }: { ctx: ChitBoardCtx }) {
  const { t } = useTranslation();
  const { board, scheme } = ctx;

  return (
    <>
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

    </>
  );
}
