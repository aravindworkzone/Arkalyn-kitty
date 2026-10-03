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
  useSetCreditLimitMutation,
  useRepayCreditMutation,
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
 * when recording an expense and repays here. "Credit given by this group" is
 * this group lending: it accepts requests and sets each line's limit. The
 * server enforces the same split — only the Reserve sets a limit, only the
 * Family group repays.
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
const availableOn = (link: GroupLink) => Math.max(0, (link.creditLimit ?? 0) - owedOn(link));

type OpenForm = { linkId: string; kind: "repay" | "limit" } | null;

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
  // Which row's repay / set-limit form is open, and what's typed in it.
  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const [amount, setAmount] = useState("");
  // Starting limit typed next to each pending request, keyed by link id.
  const [approveLimits, setApproveLimits] = useState<Record<string, string>>({});

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
  const [setCreditLimit, { isLoading: isSettingLimit }] = useSetCreditLimitMutation();
  const [repayCredit, { isLoading: isRepaying }] = useRepayCreditMutation();
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
  //  • Outgoing — this group lends. What gates accepting and setting a limit is
  //    the COUNTERPART's plan, which only the API can tell us (`hostCanReceive`).
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

  const openFormFor = (linkId: string, kind: "repay" | "limit", prefill = "") => {
    setOpenForm({ linkId, kind });
    setAmount(prefill);
  };

  const onRequest = async () => {
    if (!sourceRef.trim()) return;
    const ok = await run(
      () => requestLink({ groupId: groupId!, sourceGroupRef: sourceRef.trim() }).unwrap(),
      t("connections.requestSent", "Request sent. The Reserve group's admins decide next.")
    );
    if (ok) setSourceRef("");
  };

  const onRepay = async (linkId: string) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    const ok = await run(
      () => repayCredit({ groupId: groupId!, linkId, amount: value }).unwrap(),
      t("connections.repaid", "Repayment sent to the Reserve group.")
    );
    if (ok) setOpenForm(null);
  };

  const onSetLimit = async (linkId: string) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) return;
    const ok = await run(
      () => setCreditLimit({ groupId: groupId!, linkId, creditLimit: value }).unwrap(),
      t("connections.limitSaved", "Credit limit saved.")
    );
    if (ok) setOpenForm(null);
  };

  const onApprove = (linkId: string) => {
    const raw = approveLimits[linkId]?.trim();
    const creditLimit = raw ? Number(raw) : undefined;
    return run(
      () =>
        approveLink({
          groupId: groupId!,
          linkId,
          ...(creditLimit !== undefined && Number.isFinite(creditLimit) ? { creditLimit } : {}),
        }).unwrap(),
      t("connections.approved", "Credit line opened.")
    );
  };

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
  const walletBalance = group?.balance ?? 0;

  /** One row, shared by both directions — only the actions differ. */
  const Row = ({
    link,
    counterpart,
    children,
  }: {
    link: GroupLink;
    counterpart: LinkedGroupRef;
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
        <div className="grid grid-cols-3 gap-2 text-theme-xs">
          <Stat label={t("connections.limit", "Credit limit")} value={money(link.creditLimit ?? 0)} />
          <Stat
            label={t("connections.owed", "Owed")}
            value={money(owedOn(link))}
            tone={owedOn(link) > 0 ? "warning" : undefined}
          />
          <Stat label={t("connections.available", "Available")} value={money(availableOn(link))} />
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
            "A Reserve group works like a credit card for your Family groups. The Reserve sets a limit, the Family group pays for expenses with Reserve credit, and repays whenever it likes."
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
                    const isOpen = openForm?.linkId === link._id && openForm.kind === "repay";
                    const owed = owedOn(link);
                    const maxRepay = Math.min(owed, walletBalance);
                    return (
                      <Row key={link._id} link={link} counterpart={ref(link.sourceGroupId)}>
                        {link.status === "PENDING" && (
                          <p className="text-theme-xs text-fg-muted">
                            {t("connections.awaitingThem", "Waiting for the Reserve group's admins to accept.")}
                          </p>
                        )}

                        {link.status === "ACTIVE" && (link.creditLimit ?? 0) === 0 && (
                          <p className="text-theme-xs text-fg-muted">
                            {t(
                              "connections.noLimitYet",
                              "The Reserve group hasn't set a credit limit yet, so this group can't spend on its credit."
                            )}
                          </p>
                        )}

                        {isAdmin && owed > 0 && !isClosed && (
                          isOpen ? (
                            <div className="space-y-2 pt-1">
                              <AmountInput
                                value={amount}
                                onChange={setAmount}
                                max={maxRepay}
                                size="sm"
                                placeholder="0"
                              />
                              <p className="text-theme-xs text-fg-muted" translate="no">
                                {t("connections.repayHint", {
                                  defaultValue: "You owe {{owed}}. This group's wallet has {{wallet}}.",
                                  owed: money(owed),
                                  wallet: money(walletBalance),
                                })}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  loading={isRepaying}
                                  disabled={!Number(amount)}
                                  onClick={() => onRepay(link._id)}
                                >
                                  {t("connections.confirmRepay", "Repay")}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={maxRepay <= 0}
                                  onClick={() => setAmount(String(maxRepay))}
                                >
                                  {t("connections.repayAll", "Pay maximum")}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setOpenForm(null)}>
                                  {t("connections.cancel", "Cancel")}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => openFormFor(link._id, "repay")}>
                                {t("connections.repay", "Repay Reserve")}
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
                      "Enter the ID of a Reserve group (like Grp-25-001) to ask it for a credit line. Its admins accept and set your credit limit."
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
                    const isOpen = openForm?.linkId === link._id && openForm.kind === "limit";
                    // The borrower pays for the connection, so a Free counterpart
                    // blocks accepting and changing the limit — nothing this group
                    // can fix by upgrading itself, which is why the notice names them.
                    const hostBlocked =
                      link.hostCanReceive === false &&
                      (link.status === "PENDING" || link.status === "ACTIVE");
                    return (
                      <Row key={link._id} link={link} counterpart={counterpart}>
                        {hostBlocked && isAdmin && (
                          <p className="text-theme-xs px-3 py-2 rounded-lg border border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-500/25 dark:bg-warning-500/10 dark:text-warning-300">
                            {t("connections.hostNeedsPlan", {
                              defaultValue:
                                "{{name}} is on the Free plan and can't hold Reserve credit. They need to upgrade — your group's plan isn't the blocker.",
                              name: counterpart.name,
                            })}
                          </p>
                        )}

                        {/* A request they made of us: ours to answer, with a
                            starting limit so they can use the line at once. */}
                        {link.status === "PENDING" && isAdmin && (
                          <div className="space-y-2">
                            <AmountInput
                              value={approveLimits[link._id] ?? ""}
                              onChange={(v) => setApproveLimits((m) => ({ ...m, [link._id]: v }))}
                              size="sm"
                              placeholder={t("connections.limitPlaceholder", "Credit limit")}
                            />
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

                        {link.status === "ACTIVE" && isAdmin && (
                          isOpen ? (
                            <div className="space-y-2 pt-1">
                              <AmountInput value={amount} onChange={setAmount} size="sm" placeholder="0" />
                              <p className="text-theme-xs text-fg-muted" translate="no">
                                {t("connections.limitHint", {
                                  defaultValue:
                                    "{{name}} owes {{owed}}. A limit below that only stops new spending until they repay.",
                                  name: counterpart.name,
                                  owed: money(owedOn(link)),
                                })}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  loading={isSettingLimit}
                                  disabled={amount.trim() === ""}
                                  onClick={() => onSetLimit(link._id)}
                                >
                                  {t("connections.saveLimit", "Save limit")}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setOpenForm(null)}>
                                  {t("connections.cancel", "Cancel")}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                disabled={!canActOnOutgoing || !link.hostCanReceive}
                                onClick={() => openFormFor(link._id, "limit", String(link.creditLimit ?? 0))}
                              >
                                {t("connections.setLimit", "Set credit limit")}
                              </Button>
                              <RemoveControl link={link} />
                            </div>
                          )
                        )}
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
