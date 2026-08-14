import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetTransactionQuery, useGetBasicTransactionQuery, useGetEventQuery } from "../redux/api/group";
import DetailModal from "../components/DetailModal";
import { actionTone, eventConfig } from "../helpers/constants";
import { toneChip, toneText } from "../helpers/tone";
import { eventDescription } from "../helpers/formatters";
import { ActionButton, PageBackground, PageHeader, SegmentedToggle } from "../components/ui";
import { useTranslation } from "react-i18next";

const PAGE_STEP = 20;
const MAX_LIMIT = 200;

export default function ReportPage() {
  const { groupId } = useParams();
  const navigate    = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab]           = useState<"transactions" | "events">("transactions");
  const [txFilter, setTxFilter] = useState<"ALL" | "CREDIT" | "DEBIT" | "REFUND">("ALL");
  const [limit, setLimit]       = useState(PAGE_STEP);
  const [selectedTx,    setSelectedTx]    = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const { data: txData, isLoading: txLoading, isFetching: txFetching } = useGetTransactionQuery(
    { groupId: groupId || "", limit },
    { refetchOnMountOrArgChange: true }
  );
  const { data: basic } = useGetBasicTransactionQuery(groupId || "", { skip: !groupId });
  const { data: Events, isLoading: evLoading } = useGetEventQuery(groupId || "", { refetchOnMountOrArgChange: true });

  const Transactions = txData?.items ?? [];
  const txTotal = txData?.total ?? 0;
  const canLoadMore = Transactions.length < txTotal && limit < MAX_LIMIT;

  const filteredTx = txFilter === "ALL"
    ? Transactions
    : Transactions.filter((t: any) => t.action === txFilter);

  // Summary totals come from the whole-group aggregate, so they stay correct
  // even though the transaction list below is paginated.
  const totalCredit = basic?.CREDIT ?? 0;
  const totalDB = basic?.DEBIT ?? 0;
  const totalRefund = basic?.REFUND ?? 0;
  const totalDebit = totalDB !== 0 ? totalDB - totalRefund : 0;

  const filterLabels: Record<string, string> = {
    ALL:    t("report.filterAll"),
    CREDIT: t("report.filterCredit"),
    DEBIT:  t("report.filterDebit"),
    REFUND: t("report.filterRefund"),
  };

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />


      <div className="relative max-w-2xl mx-auto px-4 pt-8 pb-18 space-y-4">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-fg-muted hover:text-fg active:text-fg text-theme-xs font-medium transition-colors mb-4
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t("report.back")}
        </button>

        <div className="flex justify-end -mb-4">
          <ActionButton
            tone="brand"
            fullWidth={false}
            onClick={() => navigate(`/groups/${groupId}/reports/categories`)}
            className="flex items-center gap-1.5 px-3 !py-1.5 !text-theme-xs"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 1.5v5.5l4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {t("report.categoryReport")}
          </ActionButton>
        </div>

        <PageHeader
          accent="brand"
          icon={
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 12V6l4-4h6l2 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label={t("report.label")}
          title={t("report.title")}
          description={t("report.description")}
        />

        {/* Three totals, each a single headline number — a stat tile, not a
            chart. Tones are the reserved status colours, not series colours. */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t("report.totalIn"),  value: totalCredit, tone: "success" as const },
            { label: t("report.totalOut"), value: totalDebit,  tone: "error"   as const },
            { label: t("report.refunds"),  value: totalRefund, tone: "warning" as const },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface-raised border border-line rounded-xl px-4 py-3 shadow-theme-xs">
              <p className="text-theme-2xs uppercase tracking-widest text-fg-muted mb-1">{stat.label}</p>
              <p className={`text-theme-xl font-semibold font-mono ${toneText[stat.tone]}`} translate="no">
                ₹{stat.value.toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </div>

        {/* Sticks below the global header so the Transactions/Activity switch
            stays reachable while scrolling a long list. */}
        <div className="sticky top-14 lg:top-16 z-sticky -mx-4 px-4 py-2 bg-surface/95 backdrop-blur-md">
          <SegmentedToggle
            className="w-full [&>button]:flex-1"
            options={[
              { value: "transactions", label: t("report.tabTransactions") },
              { value: "events",       label: t("report.tabActivity") },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel={t("report.title")}
          />
        </div>

        {tab === "transactions" && (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {(["ALL", "CREDIT", "DEBIT", "REFUND"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  aria-pressed={txFilter === f}
                  className={`px-3 py-1.5 rounded-lg text-theme-xs font-semibold border transition-all duration-150
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                    txFilter === f
                      ? "bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/35 dark:text-brand-300"
                      : "bg-surface-raised border-line text-fg-muted hover:bg-surface-hover hover:text-fg"
                  }`}
                >
                  {filterLabels[f]}
                </button>
              ))}
            </div>

            <div className="bg-surface-raised border border-line rounded-2xl overflow-hidden shadow-theme-xs">
              {txLoading ? (
                <div className="divide-y divide-line">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-4 gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-surface-hover shrink-0 animate-pulse" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 bg-line rounded animate-pulse w-3/4" />
                          <div className="h-2.5 bg-surface-hover rounded animate-pulse w-1/3" />
                        </div>
                      </div>
                      <div className="h-4 w-16 bg-line rounded animate-pulse shrink-0" />
                    </div>
                  ))}
                </div>
              ) : filteredTx?.length === 0 ? (
                <p className="text-center text-fg-muted text-theme-xs py-10">{t("report.noTransactions")}</p>
              ) : (
                <div className="divide-y divide-line">
                  {filteredTx?.map((tx: any, i: any) => {
                    const tone = actionTone[tx.action] ?? "neutral";
                    return (
                      <div
                        key={tx._id}
                        onClick={() => setSelectedTx(tx)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedTx(tx);
                          }
                        }}
                        aria-label={t("report.openTransaction", "Open transaction details")}
                        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition-colors"
                        style={{ animation: "fadeSlideIn 0.2s ease forwards", animationDelay: `${i * 40}ms`, opacity: 0 }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-theme-2xs font-bold border ${toneChip[tone]}`}>
                            {tx.action === "CREDIT" ? "↑" : tx.action === "DEBIT" ? "↓" : "↺"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-theme-sm font-medium text-fg truncate leading-tight" translate="no">
                              {tx.description}
                            </p>
                            <p className="text-theme-2xs text-fg-muted mt-0.5" translate="no">
                              {tx.performedBy.name} · {tx.createdAt}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-3">
                          <p className={`text-theme-sm font-semibold font-mono ${toneText[tone]}`} translate="no">
                            {tx.action === "DEBIT" ? "-" : "+"}₹{tx.amount.toLocaleString("en-IN")}
                          </p>
                          <span className={`text-theme-2xs font-semibold px-1.5 py-0.5 rounded-md border ${toneChip[tone]}`}>
                            {t(`actions.${tx.action}`)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {!txLoading && canLoadMore && (
              <button
                onClick={() => setLimit((l) => Math.min(l + PAGE_STEP, MAX_LIMIT))}
                disabled={txFetching}
                className="w-full py-2.5 rounded-xl border border-line text-fg-muted text-theme-xs font-semibold
                  hover:bg-surface-hover hover:text-fg active:bg-surface-hover disabled:opacity-50 transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                {txFetching
                  ? t("report.loading", "Loading…")
                  : t("report.loadMore", "Load more")}
              </button>
            )}
          </div>
        )}

        {tab === "events" && (
          <div className="bg-surface-raised border border-line rounded-2xl overflow-hidden shadow-theme-xs">
            {evLoading ? (
              <div className="divide-y divide-line">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start gap-4 px-5 py-4">
                    <div className="w-8 h-8 rounded-xl bg-surface-hover shrink-0 animate-pulse" />
                    <div className="space-y-1.5 flex-1 pt-0.5">
                      <div className="h-3 bg-line rounded animate-pulse w-2/3" />
                      <div className="h-2.5 bg-surface-hover rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : Events?.length === 0 ? (
              <p className="text-center text-fg-muted text-theme-xs py-10">{t("report.noActivity")}</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[42px] top-0 bottom-0 w-px bg-line" />

                <div className="divide-y divide-line">
                  {Events?.map((event: any, i: any) => {
                    const cfg = eventConfig[event.eventType];
                    const tone = cfg?.tone ?? "neutral";
                    return (
                      <div
                        key={event._id}
                        onClick={() => setSelectedEvent(event)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedEvent(event);
                          }
                        }}
                        aria-label={t("report.openEvent", "Open event details")}
                        className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition-colors relative"
                        style={{ animation: "fadeSlideIn 0.2s ease forwards", animationDelay: `${i * 40}ms`, opacity: 0 }}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border relative z-10 ${toneChip[tone]}`}>
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            {cfg?.icon}
                          </svg>
                        </div>

                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-theme-sm font-medium text-fg leading-tight" translate="no">
                            {eventDescription(event)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-theme-2xs font-semibold px-1.5 py-0.5 rounded-md border ${toneChip[tone]}`}>
                              {t(`events.${event.eventType}`)}
                            </span>
                            <span className="text-theme-2xs text-fg-muted" translate="no">
                              by {event.performedBy.name} · {event.createdAt}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Transaction detail modal ── */}
      {selectedTx && (() => {
        const tone = actionTone[selectedTx.action] ?? "success";
        return (
          <DetailModal isOpen title={t("report.transactionDetail")} onClose={() => setSelectedTx(null)}>
            <div className="mb-5 pb-5 border-b border-line">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-theme-xs font-semibold mb-3 ${toneChip[tone]}`}>
                {selectedTx.action === "CREDIT" ? "↑" : selectedTx.action === "DEBIT" ? "↓" : "↺"}
                {t(`actions.${selectedTx.action}`)}
              </div>
              <p className={`font-mono text-title-md font-semibold leading-none ${toneText[tone]}`} translate="no">
                {selectedTx.action === "DEBIT" ? "-" : "+"}₹{selectedTx.amount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="space-y-0 divide-y divide-line">
              {[
                { label: t("report.fieldDescription"), value: selectedTx.description },
                { label: t("report.fieldPerformedBy"), value: selectedTx.performedBy?.name },
                { label: t("report.fieldReference"),   value: selectedTx.referenceModel },
                { label: t("report.fieldDate"),        value: selectedTx.createdAt },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-6 py-2.5">
                  <span className="text-theme-2xs font-semibold uppercase tracking-widest text-fg-muted shrink-0 pt-0.5">{label}</span>
                  <span className="text-theme-sm text-fg text-right" translate="no">{value ?? "—"}</span>
                </div>
              ))}
            </div>
          </DetailModal>
        );
      })()}

      {/* ── Event detail modal ── */}
      {selectedEvent && (() => {
        const cfg = eventConfig[selectedEvent.eventType];
        const tone = cfg?.tone ?? "neutral";
        const meta = selectedEvent.metadata || {};
        // `note` is already shown above and `changes` gets its own before→after
        // section, so keep them out of the generic key/value list.
        const metaEntries = Object.entries(meta).filter(([k]) => !["__v", "note", "changes"].includes(k));
        const changes = (meta.changes && typeof meta.changes === "object" ? meta.changes : null) as
          | Record<string, { from: unknown; to: unknown }>
          | null;
        const changeEntries = changes ? Object.entries(changes) : [];
        return (
          <DetailModal isOpen title={t("report.activityDetail")} onClose={() => setSelectedEvent(null)}>
            <div className="mb-5 pb-5 border-b border-line">
              <span className={`inline-block text-theme-xs font-semibold px-2.5 py-1 rounded-lg border mb-3 ${toneChip[tone]}`}>
                {t(`events.${selectedEvent.eventType}`)}
              </span>
              <p className="text-theme-sm font-medium text-fg leading-snug" translate="no">{meta.note || t("report.groupActivity")}</p>
            </div>
            <div className="divide-y divide-line">
              {[
                { label: t("report.fieldPerformedBy"), value: selectedEvent.performedBy?.name },
                { label: t("report.fieldDate"),        value: selectedEvent.createdAt },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-6 py-2.5">
                  <span className="text-theme-2xs font-semibold uppercase tracking-widest text-fg-muted shrink-0 pt-0.5">{label}</span>
                  <span className="text-theme-sm text-fg text-right" translate="no">{value ?? "—"}</span>
                </div>
              ))}
              {changeEntries.length > 0 && (
                <div className="pt-3">
                  <p className="text-theme-2xs font-semibold uppercase tracking-widest text-fg-muted mb-2">{t("report.fieldChanges", "Changes")}</p>
                  <div className="space-y-2">
                    {changeEntries.map(([k, diff]) => (
                      <div key={k} className="flex flex-col gap-1">
                        <span className="text-theme-xs text-fg-muted capitalize">{k}</span>
                        <div className="flex items-center gap-2 text-theme-xs font-mono break-all" translate="no">
                          <span className="text-error-600 dark:text-error-400 line-through">{String(diff.from)}</span>
                          <span className="text-fg-muted">→</span>
                          <span className="text-success-700 dark:text-success-400">{String(diff.to)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {metaEntries.length > 0 && (
                <div className="pt-3">
                  <p className="text-theme-2xs font-semibold uppercase tracking-widest text-fg-muted mb-2">{t("report.fieldDetails")}</p>
                  <div className="space-y-1.5">
                    {metaEntries.map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-4">
                        <span className="text-theme-xs text-fg-muted capitalize">{k}</span>
                        <span className="text-theme-xs text-fg text-right font-mono break-all" translate="no">
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DetailModal>
        );
      })()}
    </div>
  );
}
