import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import NotFoundPage from "./NotFoundPage";
import { useGetGroupByIdQuery } from "../redux/api/group";
import {
  useGetGroupLinksQuery,
  useRequestLinkMutation,
  useApproveLinkMutation,
  useRejectLinkMutation,
  useSendToReserveMutation,
  useRevokeLinkMutation,
} from "../redux/api/groupLink";
import { useGroupPlan } from "../hooks/usePlan";
import { useGroupType } from "../hooks/useGroupType";
import type { Group } from "../interface/group";
import type { GroupLink, GroupLinkStatus, LinkedGroupRef } from "../interface/groupLink";
import {
  AmountInput,
  BackButton,
  Badge,
  Button,
  Card,
  FieldInput,
  INPUT_CLASS,
  PageBackground,
  PageContainer,
  PageHeader,
  StatusBanner,
} from "../components/ui";
import type { BadgeTone } from "../components/ui";

/**
 * Connected Groups — Reserve credit lines into and out of this group.
 *
 * A Reserve works like a credit card for the Family groups it is linked to.
 * "Credit from Reserve groups" is this group borrowing: it spends on credit
 * when recording an expense, and sends money to the Reserve here — paying off
 * what it owes first, depositing the rest. "Credit given by this group" is this
 * group lending: it accepts requests, up to its fixed limit and its wallet.
 * The server enforces the same split — only the Reserve accepts, only the
 * Family group sends money in.
 */

const money = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const STATUS_TONE: Record<GroupLinkStatus, BadgeTone> = {
  ACTIVE: "success",
  PENDING: "warning",
  REJECTED: "error",
  REVOKED: "gray",
};

/** The populated counterpart, or a bare id if population ever fails. */
const ref = (v: LinkedGroupRef | string): LinkedGroupRef =>
  typeof v === "string" ? { _id: v, name: v, displayId: "" } : v;

const owedOn = (link: GroupLink) => link.outstanding ?? 0;
/** A Reserve's available credit is its wallet balance — no separate limit. */
/** What a Family group can spend on this line now — resolved by the API. */
const availableOn = (link: GroupLink) => Math.max(0, link.availableCredit ?? 0);

export default function GroupConnectionsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  // This group's plan, not the viewer's — so an admin who has never paid still
  // sees live controls in a group someone else upgraded, and nobody is shown an
  // upsell for a group that is already Pro.
  const { features } = useGroupPlan(groupId);
  const { features: groupTypeFeatures } = useGroupType(groupId);

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sourceRef, setSourceRef] = useState("");
  // Which row's send-to-Reserve form is open, and what's typed in it.
  const [sendLinkId, setSendLinkId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const { data: group, isLoading: groupLoading, isError: groupError } = useGetGroupByIdQuery(
    groupId!,
    { skip: !groupId }
  );
  const { data: links, isLoading: linksLoading } = useGetGroupLinksQuery(groupId!, {
    skip: !groupId,
  });

  const [requestLink, { isLoading: isRequesting }] = useRequestLinkMutation();
  const [approveLink, { isLoading: isApproving }] = useApproveLinkMutation();
  const [rejectLink, { isLoading: isRejecting }] = useRejectLinkMutation();
  const [sendToReserve, { isLoading: isSending }] = useSendToReserveMutation();
  const [revokeLink, { isLoading: isRevoking }] = useRevokeLinkMutation();

  const role = group?.role as Group["role"];
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isClosed = group?.status === "CLOSED";
  // Writes split by DIRECTION, because the group holding the credit line is
  // the one that pays for the connection:
  //
  //  • Incoming — this group would borrow, so asking for a credit line is gated
  //    on its own plan and on its type (only a Family group can borrow: credit
  //    is spent through expenses). Repaying is never gated — paying back a debt
  //    must work on any plan.
  //  • Outgoing — this group lends. What gates accepting is the COUNTERPART's
  //    plan, which only the API can tell us (`hostCanReceive`).
  //
  // Declining and removing are never plan-gated: saying no, and unwinding
  // something already agreed, must work on any plan.
  const canRequestFunding =
    isAdmin && features.linkGroups && !isClosed && groupTypeFeatures.receiveFunding;
  // Whether THIS group may lend at all — a property of its type. Only a Reserve.
  const canFundOthers = groupTypeFeatures.fundOthers;
  const canActOnOutgoing = isAdmin && !isClosed;

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      return true;
    } catch (err: any) {
      setMsg({
        ok: false,
        text: err?.data?.message || t("connections.actionFailed", "That didn't work. Try again."),
      });
      return false;
    }
  };

  const openSend = (linkId: string) => {
    setSendLinkId(linkId);
    setAmount("");
  };

  const onRequest = async () => {
    if (!sourceRef.trim()) return;
    const ok = await run(
      () => requestLink({ groupId: groupId!, sourceGroupRef: sourceRef.trim() }).unwrap(),
      t("connections.requestSent", "Request sent. The Reserve group's admins decide next.")
    );
    if (ok) setSourceRef("");
  };

  const onSend = async (linkId: string) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    const ok = await run(
      () => sendToReserve({ groupId: groupId!, linkId, amount: value }).unwrap(),
      t("connections.sent", "Money sent to the Reserve group.")
    );
    if (ok) setSendLinkId(null);
  };

  const onApprove = (linkId: string) =>
    run(
      () => approveLink({ groupId: groupId!, linkId }).unwrap(),
      t("connections.approved", "Credit line opened.")
    );

  const onRevoke = (linkId: string) =>
    run(
      () => revokeLink({ groupId: groupId!, linkId }).unwrap(),
      t("connections.removed", "Connection removed.")
    );

  if (groupError) return <NotFoundPage />;

  if (groupLoading) {
    return (
      <div className="min-h-screen bg-surface text-fg">
        <PageBackground />
        <PageContainer width="content" className="animate-pulse">
          <div className="h-4 w-24 bg-surface-hover rounded" />
          <div className="space-y-2 pt-2">
            <div className="h-3 w-20 bg-surface-hover rounded" />
            <div className="h-6 w-56 bg-line rounded" />
          </div>
          <div className="h-40 rounded-xl bg-surface-raised border border-line" />
          <div className="h-40 rounded-xl bg-surface-raised border border-line" />
        </PageContainer>
      </div>
    );
  }

  const incoming = links?.incoming ?? [];
  const outgoing = links?.outgoing ?? [];
  const reserveCredit = links?.reserveCredit ?? null;
  const walletBalance = group?.balance ?? 0;

  /**
   * One row, shared by both directions — only the figures and actions differ.
   * Borrowing, the counterpart is the Reserve, so the credit it can give (its
   * balance) is shown; lending, only what this borrower owes is per-row.
   */
  const Row = ({
    link,
    counterpart,
    borrowing,
    children,
  }: {
    link: GroupLink;
    counterpart: LinkedGroupRef;
    borrowing: boolean;
    children?: React.ReactNode;
  }) => (
    <div className="border border-line rounded-xl px-4 py-3.5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-theme-sm font-medium text-fg truncate" translate="no">
            {counterpart.name}
          </p>
          {counterpart.displayId && (
            <p className="text-theme-xs text-fg-muted" translate="no">
              {counterpart.displayId}
            </p>
          )}
        </div>
        <Badge tone={STATUS_TONE[link.status]}>
          {t(`connections.status.${link.status}`, link.status)}
        </Badge>
      </div>

      {(link.status === "ACTIVE" || owedOn(link) > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-theme-xs">
          {borrowing && (
            <Stat
              label={t("connections.reserveLimit", "Reserve's limit")}
              value={money(counterpart.creditLimit ?? 0)}
            />
          )}
          {borrowing && (
            <Stat
              label={t("connections.availableCredit", "Available credit")}
              value={money(availableOn(link))}
            />
          )}
          <Stat
            label={t("connections.owed", "Owed")}
            value={money(owedOn(link))}
            tone={owedOn(link) > 0 ? "warning" : undefined}
          />
        </div>
      )}

      {link.status === "ACTIVE" && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-theme-xs">
          {/* Drills through to the pre-filtered ledger, the same way a report
              card does — the total and the list it stands for should never be
              more than a click apart. */}
          {link.attributedSpend !== undefined && link.attributedSpend > 0 && (
            <span className="text-fg-muted">
              {t("connections.attributed", "Spent with this Reserve")}{" "}
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/groups/${groupId}/expenses?fundedBy=${counterpart._id}` +
                      `&label=${encodeURIComponent(
                        t("connections.drillLabel", "Paid with {{group}}", {
                          group: counterpart.name,
                        })
                      )}`
                  )
                }
                className="underline decoration-dotted underline-offset-2 rounded-sm text-fg font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                translate="no"
              >
                {money(link.attributedSpend)}
              </button>
            </span>
          )}
          {(link.deposited ?? 0) > 0 && (
            <span className="text-fg-muted">
              {t("connections.depositedLabel", "Deposited into the Reserve")}{" "}
              <span className="text-fg font-medium" translate="no">
                {money(link.deposited ?? 0)}
              </span>
            </span>
          )}
          {link.contribution > 0 && (
            <span className="text-fg-muted">
              {t("connections.earlierGifts", "Earlier gifts (not owed)")}{" "}
              <span className="text-fg font-medium" translate="no">
                {money(link.contribution)}
              </span>
            </span>
          )}
        </div>
      )}

      {children}
    </div>
  );

  /** "Remove connection", or why it can't be removed yet. */
  const RemoveControl = ({ link }: { link: GroupLink }) =>
    owedOn(link) > 0 ? (
      <p className="text-theme-xs text-fg-muted">
        {t("connections.removeBlocked", "This connection can be removed once nothing is owed on it.")}
      </p>
    ) : (
      <Button variant="ghost" size="sm" loading={isRevoking} onClick={() => onRevoke(link._id)}>
        {t("connections.remove", "Remove connection")}
      </Button>
    );

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />

      <PageContainer width="content">
        <div className="inline-block">
          <BackButton
            label={t("groupManagement.backToGroup", "Back to group")}
            onClick={() => navigate(`/groups/${groupId}`)}
          />
        </div>

        <PageHeader
          accent="brand"
          icon={
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M5.6 8.4 8.4 5.6M4.9 3.5l.7-.7a2.47 2.47 0 0 1 3.5 3.5l-.7.7M9.1 10.5l-.7.7a2.47 2.47 0 0 1-3.5-3.5l.7-.7"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          }
          label={t("connections.label", "Connections")}
          title={t("connections.title", "Connected Groups")}
          description={t(
            "connections.description",
            "A Reserve group works like a credit card for your Family groups. It sets a fixed limit; the Family group pays for expenses with Reserve credit, and sends money to the Reserve whenever it likes — paying off what it owes first, depositing the rest."
          )}
        />

        <div className="space-y-4 max-w-3xl">
          <StatusBanner status={msg ? (msg.ok ? "ok" : "err") : null} text={msg?.text ?? ""} />

          {isAdmin && !features.linkGroups && !isClosed && groupTypeFeatures.receiveFunding && (
            <div className="text-theme-xs px-4 py-3 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300 flex flex-wrap items-center justify-between gap-2">
              <span>
                {t(
                  "connections.upgradeNotice",
                  "Reserve credit is a Pro feature. You can still see connections, repay what is owed, and remove settled ones."
                )}
              </span>
              <button
                onClick={() => navigate(`/pricing?group=${groupId}`)}
                className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded"
              >
                {t("connections.upgradeCta", "Upgrade this group")}
              </button>
            </div>
          )}

          {/* ── This Reserve's credit: fixed limit, lent out, wallet, available ── */}
          {reserveCredit && (
            <Card title={t("connections.reserveCreditTitle", "This Reserve's credit")}>
              <div className="space-y-3">
                <p className="text-theme-xs text-fg-muted">
                  {t(
                    "connections.reserveCreditHint",
                    "Family groups can spend up to the fixed limit, as long as the wallet holds the money. Contributions refill the wallet; the limit only changes in Group Management → Credit limit."
                  )}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-theme-xs">
                  <Stat label={t("connections.limit", "Credit limit")} value={money(reserveCredit.creditLimit)} />
                  <Stat
                    label={t("connections.lentOut", "Lent out")}
                    value={money(reserveCredit.creditUsed)}
                    tone={reserveCredit.creditUsed > 0 ? "warning" : undefined}
                  />
                  <Stat label={t("connections.wallet", "Wallet")} value={money(reserveCredit.balance)} />
                  <Stat
                    label={t("connections.availableCredit", "Available credit")}
                    value={money(reserveCredit.available)}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* ── Incoming: credit this group borrows ─────────────────────────── */}
          {(groupTypeFeatures.receiveFunding || incoming.length > 0) && (
            <Card title={t("connections.incomingTitle", "Credit from Reserve groups")}>
              {linksLoading ? (
                <div className="h-16 rounded-lg bg-surface-hover animate-pulse" />
              ) : incoming.length === 0 ? (
                <p className="text-theme-xs text-fg-muted">
                  {t("connections.noIncoming", "No Reserve group gives this group credit yet.")}
                </p>
              ) : (
                <div className="space-y-3">
                  {incoming.map((link) => {
                    const isOpen = sendLinkId === link._id;
                    const owed = owedOn(link);
                    // Owed is paid off first; anything above it is a deposit,
                    // which needs a live connection.
                    const maxSend = link.status === "ACTIVE" ? walletBalance : Math.min(owed, walletBalance);
                    const typed = Number(amount) || 0;
                    const willRepay = Math.min(typed, owed);
                    const willDeposit = Math.max(0, typed - willRepay);
                    const canSend = isAdmin && !isClosed && (link.status === "ACTIVE" || owed > 0);
                    const reserve = ref(link.sourceGroupId);
                    return (
                      <Row key={link._id} link={link} counterpart={reserve} borrowing>
                        {link.status === "PENDING" && (
                          <p className="text-theme-xs text-fg-muted">
                            {t("connections.awaitingThem", "Waiting for the Reserve group's admins to accept.")}
                          </p>
                        )}

                        {link.status === "ACTIVE" && availableOn(link) === 0 && (
                          <p className="text-theme-xs text-fg-muted">
                            {(reserve.creditLimit ?? 0) === 0
                              ? t(
                                  "connections.noLimitYet",
                                  "The Reserve group hasn't set a credit limit yet, so this group can't spend on its credit."
                                )
                              : t(
                                  "connections.noCreditNow",
                                  "No Reserve credit is available right now — the limit is used up or the Reserve's wallet is empty."
                                )}
                          </p>
                        )}

                        {canSend && (
                          isOpen ? (
                            <div className="space-y-2 pt-1">
                              <AmountInput
                                value={amount}
                                onChange={setAmount}
                                max={maxSend}
                                size="md"
                                placeholder="0"
                                inputClassName={INPUT_CLASS}
                              />
                              <p className="text-theme-xs text-fg-muted" translate="no">
                                {owed > 0
                                  ? t("connections.sendHintOwed", {
                                      defaultValue:
                                        "This group owes {{owed}}, which is paid off first; anything more goes into the Reserve's wallet. This group's wallet has {{wallet}}.",
                                      owed: money(owed),
                                      wallet: money(walletBalance),
                                    })
                                  : t("connections.sendHintDeposit", {
                                      defaultValue:
                                        "Nothing is owed, so this goes into the Reserve's wallet as a deposit. This group's wallet has {{wallet}}.",
                                      wallet: money(walletBalance),
                                    })}
                              </p>
                              {typed > 0 && (
                                <p className="text-theme-xs font-medium text-fg" translate="no">
                                  {t("connections.sendSplit", {
                                    defaultValue: "{{repay}} repays · {{deposit}} deposited",
                                    repay: money(willRepay),
                                    deposit: money(willDeposit),
                                  })}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  loading={isSending}
                                  disabled={!typed || typed > maxSend}
                                  onClick={() => onSend(link._id)}
                                >
                                  {t("connections.confirmSend", "Send")}
                                </Button>
                                {owed > 0 && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={Math.min(owed, walletBalance) <= 0}
                                    onClick={() => setAmount(String(Math.min(owed, walletBalance)))}
                                  >
                                    {t("connections.payOwed", "Pay what's owed")}
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => setSendLinkId(null)}>
                                  {t("connections.cancel", "Cancel")}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => openSend(link._id)}>
                                {t("connections.sendToReserve", "Send money to Reserve")}
                              </Button>
                            </div>
                          )
                        )}

                        {link.status === "ACTIVE" && isAdmin && !isOpen && <RemoveControl link={link} />}
                      </Row>
                    );
                  })}
                </div>
              )}

              {/* Asking a Reserve for a credit line — this group would hold it,
                  so its own plan is what gates it. */}
              {canRequestFunding && (
                <div className="mt-4 pt-4 border-t border-line space-y-2">
                  <p className="text-theme-xs text-fg-muted">
                    {t(
                      "connections.requestHint",
                      "Enter the ID of a Reserve group (like Grp-25-001) to ask it for a credit line. Once its admins accept, this group can spend on the Reserve's credit, up to its limit."
                    )}
                  </p>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <FieldInput
                        value={sourceRef}
                        onChange={(e) => setSourceRef(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && onRequest()}
                        placeholder="Grp-25-001"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <Button
                      size="sm"
                      loading={isRequesting}
                      disabled={!sourceRef.trim()}
                      onClick={onRequest}
                      className="shrink-0"
                    >
                      {t("connections.request", "Request")}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ── Outgoing: credit this group lends ──────────────────────────── */}
          {(canFundOthers || outgoing.length > 0) && (
            <Card title={t("connections.outgoingTitle", "Credit given by this group")}>
              {linksLoading ? (
                <div className="h-16 rounded-lg bg-surface-hover animate-pulse" />
              ) : outgoing.length === 0 ? (
                <p className="text-theme-xs text-fg-muted">
                  {t(
                    "connections.noOutgoing",
                    "This group isn't giving credit to any Family group. A Family group's admin can request a credit line using this group's ID."
                  )}
                </p>
              ) : (
                <div className="space-y-3">
                  {outgoing.map((link) => {
                    const counterpart = ref(link.hostGroupId);
                    // The borrower pays for the connection, so a Free counterpart
                    // blocks accepting and spending — nothing this group can fix
                    // by upgrading itself, which is why the notice names them.
                    const hostBlocked =
                      link.hostCanReceive === false &&
                      (link.status === "PENDING" || link.status === "ACTIVE");
                    return (
                      <Row key={link._id} link={link} counterpart={counterpart} borrowing={false}>
                        {hostBlocked && isAdmin && (
                          <p className="text-theme-xs px-3 py-2 rounded-lg border border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-500/25 dark:bg-warning-500/10 dark:text-warning-300">
                            {t("connections.hostNeedsPlan", {
                              defaultValue:
                                "{{name}} is on the Free plan and can't hold Reserve credit. They need to upgrade — your group's plan isn't the blocker.",
                              name: counterpart.name,
                            })}
                          </p>
                        )}

                        {/* A request they made of us: ours to answer. Accepting
                            lets them spend within this Reserve's limit. */}
                        {link.status === "PENDING" && isAdmin && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                loading={isApproving}
                                disabled={!canActOnOutgoing || !link.hostCanReceive}
                                onClick={() => onApprove(link._id)}
                              >
                                {t("connections.approve", "Accept")}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={isRejecting}
                                disabled={!canActOnOutgoing}
                                onClick={() =>
                                  run(
                                    () => rejectLink({ groupId: groupId!, linkId: link._id }).unwrap(),
                                    t("connections.rejected", "Request declined.")
                                  )
                                }
                              >
                                {t("connections.reject", "Decline")}
                              </Button>
                            </div>
                          </div>
                        )}

                        {link.status === "ACTIVE" && isAdmin && <RemoveControl link={link} />}
                      </Row>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      </PageContainer>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className="rounded-lg bg-surface-hover px-3 py-2">
      <p className="text-fg-muted">{label}</p>
      <p
        className={
          "font-semibold " +
          (tone === "warning" ? "text-warning-700 dark:text-warning-400" : "text-fg")
        }
        translate="no"
      >
        {value}
      </p>
    </div>
  );
}
