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
  useTransferToLinkMutation,
  useRevokeLinkMutation,
} from "../redux/api/groupLink";
import { useGroupPlan } from "../hooks/usePlan";
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
 * Connected Groups — the funding links into and out of this group.
 *
 * Direction is the organising idea and the page never blurs it. "Funding this
 * group" is money coming in, which this group's admins may only accept or
 * refuse; "Funded by this group" is money going out, which is the only place a
 * transfer can be started. That asymmetry is enforced on the server too: a host
 * can never pull from its funder.
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

export default function GroupConnectionsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  // This group's plan, not the viewer's — so an admin who has never paid still
  // sees live controls in a group someone else upgraded, and nobody is shown an
  // upsell for a group that is already Pro.
  const { features } = useGroupPlan(groupId);

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sourceRef, setSourceRef] = useState("");
  // Which outgoing link's send-funds form is open, and what's typed in it.
  const [fundingLinkId, setFundingLinkId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

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
  const [transferToLink, { isLoading: isTransferring }] = useTransferToLinkMutation();
  const [revokeLink, { isLoading: isRevoking }] = useRevokeLinkMutation();

  const role = group?.role as Group["role"];
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isClosed = group?.status === "CLOSED";
  // Reads are ungated; every write needs the paid feature and an open group.
  const canWrite = isAdmin && features.linkGroups && !isClosed;

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

  const onRequest = async () => {
    if (!sourceRef.trim()) return;
    const ok = await run(
      () => requestLink({ groupId: groupId!, sourceGroupRef: sourceRef.trim() }).unwrap(),
      t("connections.requestSent", "Request sent. The other group's admins decide next.")
    );
    if (ok) setSourceRef("");
  };

  const onSend = async (linkId: string) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    const ok = await run(
      () =>
        transferToLink({
          groupId: groupId!,
          linkId,
          amount: value,
          description: note.trim() || undefined,
        }).unwrap(),
      t("connections.fundsSent", "Funds sent.")
    );
    if (ok) {
      setAmount("");
      setNote("");
      setFundingLinkId(null);
    }
  };

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

      {link.status === "ACTIVE" && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-theme-xs">
          <span className="text-fg-muted">
            {t("connections.contributed", "Contributed")}{" "}
            <span className="text-fg font-medium" translate="no">
              {money(link.contribution)}
            </span>
          </span>
          {link.attributedSpend !== undefined && (
            <span className="text-fg-muted">
              {t("connections.attributed", "Tagged to expenses")}{" "}
              {/* Drills through to the pre-filtered ledger, the same way a
                  report card does — the total and the list it stands for
                  should never be more than a click apart. */}
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/groups/${groupId}/expenses?fundedBy=${counterpart._id}` +
                      `&label=${encodeURIComponent(
                        t("connections.drillLabel", "Funded by {{group}}", {
                          group: counterpart.name,
                        })
                      )}`
                  )
                }
                className={
                  "underline decoration-dotted underline-offset-2 rounded-sm " +
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 " +
                  (link.attributedSpend > link.contribution
                    ? "text-warning-600 dark:text-warning-400 font-medium"
                    : "text-fg font-medium")
                }
                translate="no"
              >
                {money(link.attributedSpend)}
              </button>
            </span>
          )}
        </div>
      )}

      {children}
    </div>
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
            "Groups that fund this one, and groups this one funds. Money is sent as a contribution — it is not a loan and is not paid back."
          )}
        />

        <div className="space-y-4 max-w-3xl">
          <StatusBanner status={msg ? (msg.ok ? "ok" : "err") : null} text={msg?.text ?? ""} />

          {isAdmin && !features.linkGroups && !isClosed && (
            <div className="text-theme-xs px-4 py-3 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300 flex flex-wrap items-center justify-between gap-2">
              <span>
                {t(
                  "connections.upgradeNotice",
                  "Connecting groups is a Pro feature. You can still see and remove existing connections."
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

          {/* ── Incoming: money into this group ───────────────────────────── */}
          <Card title={t("connections.incomingTitle", "Funding this group")}>
            {linksLoading ? (
              <div className="h-16 rounded-lg bg-surface-hover animate-pulse" />
            ) : incoming.length === 0 ? (
              <p className="text-theme-xs text-fg-muted">
                {t("connections.noIncoming", "No other group is funding this one yet.")}
              </p>
            ) : (
              <div className="space-y-3">
                {incoming.map((link) => (
                  <Row key={link._id} link={link} counterpart={ref(link.sourceGroupId)}>
                    {link.status === "ACTIVE" && isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={isRevoking}
                        onClick={() =>
                          run(
                            () => revokeLink({ groupId: groupId!, linkId: link._id }).unwrap(),
                            t("connections.removed", "Connection removed.")
                          )
                        }
                      >
                        {t("connections.remove", "Remove connection")}
                      </Button>
                    )}
                    {link.status === "PENDING" && (
                      <p className="text-theme-xs text-fg-muted">
                        {t(
                          "connections.awaitingThem",
                          "Waiting for their admins to accept."
                        )}
                      </p>
                    )}
                  </Row>
                ))}
              </div>
            )}

            {/* Asking another group to fund this one. */}
            {canWrite && (
              <div className="mt-4 pt-4 border-t border-line space-y-2">
                <p className="text-theme-xs text-fg-muted">
                  {t(
                    "connections.requestHint",
                    "Enter the other group's ID (like Grp-25-001). Their admins have to accept before any money can move."
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

          {/* ── Outgoing: money out of this group ──────────────────────────── */}
          <Card title={t("connections.outgoingTitle", "Funded by this group")}>
            {linksLoading ? (
              <div className="h-16 rounded-lg bg-surface-hover animate-pulse" />
            ) : outgoing.length === 0 ? (
              <p className="text-theme-xs text-fg-muted">
                {t("connections.noOutgoing", "This group isn't funding any other group.")}
              </p>
            ) : (
              <div className="space-y-3">
                {outgoing.map((link) => {
                  const counterpart = ref(link.hostGroupId);
                  const isOpen = fundingLinkId === link._id;
                  return (
                    <Row key={link._id} link={link} counterpart={counterpart}>
                      {/* A request they made of us: ours to answer. */}
                      {link.status === "PENDING" && isAdmin && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            loading={isApproving}
                            disabled={!canWrite}
                            onClick={() =>
                              run(
                                () =>
                                  approveLink({ groupId: groupId!, linkId: link._id }).unwrap(),
                                t("connections.approved", "Connection approved.")
                              )
                            }
                          >
                            {t("connections.approve", "Accept")}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={isRejecting}
                            disabled={!canWrite}
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
                      )}

                      {link.status === "ACTIVE" && isAdmin && (
                        <div className="space-y-3">
                          {!isOpen ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={!canWrite}
                                onClick={() => {
                                  setFundingLinkId(link._id);
                                  setAmount("");
                                  setNote("");
                                }}
                              >
                                {t("connections.sendFunds", "Send funds")}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                loading={isRevoking}
                                onClick={() =>
                                  run(
                                    () =>
                                      revokeLink({ groupId: groupId!, linkId: link._id }).unwrap(),
                                    t("connections.removed", "Connection removed.")
                                  )
                                }
                              >
                                {t("connections.remove", "Remove connection")}
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2 pt-1">
                              <AmountInput
                                value={amount}
                                onChange={setAmount}
                                max={group?.balance}
                                size="sm"
                                placeholder="0"
                              />
                              <p className="text-theme-xs text-fg-muted">
                                {t("connections.availableHint", "Available in this group")}{" "}
                                <span className="text-fg font-medium" translate="no">
                                  {money(group?.balance ?? 0)}
                                </span>
                              </p>
                              <FieldInput
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder={t("connections.notePlaceholder", "Note (optional)")}
                                className={INPUT_CLASS}
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  loading={isTransferring}
                                  disabled={!Number(amount)}
                                  onClick={() => onSend(link._id)}
                                >
                                  {t("connections.confirmSend", "Send")}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setFundingLinkId(null)}
                                >
                                  {t("connections.cancel", "Cancel")}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Row>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}
