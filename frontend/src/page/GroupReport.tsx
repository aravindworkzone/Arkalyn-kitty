import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/header";
import { useGetTransactionQuery, useGetBasicTransactionQuery, useGetEventQuery } from "../redux/api/group";
import DetailModal from "../components/DetailModal";
import { actionStyle, eventConfig } from "../helpers/constants";
import { eventDescription } from "../helpers/formatters";
import { Trans, useTranslation } from "react-i18next";

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
    <div className="min-h-screen bg-[#080c14] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-60 w-[600px] h-[600px] rounded-full bg-violet-600/4 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.07) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <Header />

      <div className="relative max-w-2xl mx-auto px-4 pt-8 pb-18 space-y-4">

        <button
          onClick={() => navigate(-1)}
          data-tour="activity-back"
          className="flex items-center gap-2 text-white/35 hover:text-white/60 active:text-white/60 text-xs font-medium transition-colors mb-4"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t("report.back")}
        </button>

        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M2 12V6l4-4h6l2 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" stroke="#a5b4fc" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70">{t("report.label")}</p>
            </div>
            <button
              onClick={() => navigate(`/groups/${groupId}/reports/categories`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-400/35 active:bg-indigo-500/20 active:border-indigo-400/35 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M7 1.5v5.5l4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {t("report.categoryReport")}
            </button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f0eeff]">{t("report.title")}</h1>
          <p className="text-white/35 text-sm mt-1.5">{t("report.description")}</p>
        </div>

        <div className="grid grid-cols-3 gap-2" data-tour="activity-page">
          {[
            { label: t("report.totalIn"),  value: totalCredit, color: "#34d399" },
            { label: t("report.totalOut"), value: totalDebit,  color: "#f87171" },
            { label: t("report.refunds"),  value: totalRefund, color: "#fbbf24" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{stat.label}</p>
              <p className="text-[16px] font-semibold font-mono" style={{ color: stat.color }} translate="no">
                ₹{stat.value.toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </div>

        {/* Sticks below the global header so the Transactions/Activity switch
            stays reachable while scrolling a long list. */}
        <div className="sticky top-14 lg:top-16 z-20 -mx-4 px-4 py-2 bg-[#080c14]/95 backdrop-blur-md">
        <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl">
          {(["transactions", "events"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                tab === tabKey
                  ? "bg-white/[0.08] text-white/80 shadow-sm"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              {tabKey === "transactions" ? t("report.tabTransactions") : t("report.tabActivity")}
            </button>
          ))}
        </div>
        </div>

        {tab === "transactions" && (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {(["ALL", "CREDIT", "DEBIT", "REFUND"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all duration-150 ${
                    txFilter === f
                      ? "bg-white/[0.1] border-white/[0.2] text-white/80"
                      : "bg-white/[0.03] border-white/[0.07] text-white/30 hover:bg-white/[0.06]"
                  }`}
                >
                  {filterLabels[f]}
                </button>
              ))}
            </div>

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
              {txLoading ? (
                <div className="divide-y divide-white/[0.04]">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-4 gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.05] shrink-0 animate-pulse" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 bg-white/[0.05] rounded animate-pulse w-3/4" />
                          <div className="h-2.5 bg-white/[0.04] rounded animate-pulse w-1/3" />
                        </div>
                      </div>
                      <div className="h-4 w-16 bg-white/[0.05] rounded animate-pulse shrink-0" />
                    </div>
                  ))}
                </div>
              ) : filteredTx?.length === 0 ? (
                <p className="text-center text-white/20 text-xs py-10">{t("report.noTransactions")}</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {filteredTx?.map((tx: any, i: any) => {
                    const style = actionStyle[tx.action];
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
                        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 transition-colors"
                        style={{ animation: "fadeSlideIn 0.2s ease forwards", animationDelay: `${i * 40}ms`, opacity: 0 }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-bold border"
                            style={{ background: style.bg, borderColor: style.border, color: style.color }}
                          >
                            {tx.action === "CREDIT" ? "↑" : tx.action === "DEBIT" ? "↓" : "↺"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-white/75 truncate leading-tight" translate="no">
                              {tx.description}
                            </p>
                            <p className="text-[10px] text-white/25 mt-0.5" translate="no">
                              {tx.performedBy.name} · {tx.createdAt}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-3">
                          <p
                            className="text-[14px] font-semibold font-mono"
                            style={{ color: style.color }}
                            translate="no"
                          >
                            {tx.action === "DEBIT" ? "-" : "+"}₹{tx.amount.toLocaleString("en-IN")}
                          </p>
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border"
                            style={{ background: style.bg, borderColor: style.border, color: style.color }}
                          >
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
                className="w-full py-2.5 rounded-xl border border-white/10 text-white/50 text-xs font-semibold hover:bg-white/[0.04] active:bg-white/[0.04] disabled:opacity-50 transition-colors"
              >
                {txFetching
                  ? t("report.loading", "Loading…")
                  : t("report.loadMore", "Load more")}
              </button>
            )}
          </div>
        )}

        {tab === "events" && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            {evLoading ? (
              <div className="divide-y divide-white/[0.04]">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start gap-4 px-5 py-4">
                    <div className="w-8 h-8 rounded-xl bg-white/[0.05] shrink-0 animate-pulse" />
                    <div className="space-y-1.5 flex-1 pt-0.5">
                      <div className="h-3 bg-white/[0.05] rounded animate-pulse w-2/3" />
                      <div className="h-2.5 bg-white/[0.04] rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : Events?.length === 0 ? (
              <p className="text-center text-white/20 text-xs py-10">{t("report.noActivity")}</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[42px] top-0 bottom-0 w-px bg-white/[0.05]" />

                <div className="divide-y divide-white/[0.04]">
                  {Events?.map((event: any, i: any) => {
                    const cfg = eventConfig[event.eventType];
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
                        className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 transition-colors relative"
                        style={{ animation: "fadeSlideIn 0.2s ease forwards", animationDelay: `${i * 40}ms`, opacity: 0 }}
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border relative z-10"
                          style={{
                            background: cfg.color + "18",
                            borderColor: cfg.color + "40",
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: cfg.color }}>
                            {cfg.icon}
                          </svg>
                        </div>

                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[13px] font-medium text-white/75 leading-tight" translate="no">
                            {eventDescription(event)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border"
                              style={{ background: cfg.color + "15", borderColor: cfg.color + "35", color: cfg.color }}
                            >
                              {t(`events.${event.eventType}`)}
                            </span>
                            <span className="text-[10px] text-white/25" translate="no">
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
        const style = actionStyle[selectedTx.action] ?? actionStyle.CREDIT;
        return (
          <DetailModal isOpen title={t("report.transactionDetail")} onClose={() => setSelectedTx(null)}>
            <div className="mb-5 pb-5 border-b border-white/[0.06]">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold mb-3"
                style={{ background: style.bg, borderColor: style.border, color: style.color }}
              >
                {selectedTx.action === "CREDIT" ? "↑" : selectedTx.action === "DEBIT" ? "↓" : "↺"}
                {t(`actions.${selectedTx.action}`)}
              </div>
              <p className="font-mono text-[32px] font-semibold leading-none" style={{ color: style.color }} translate="no">
                {selectedTx.action === "DEBIT" ? "-" : "+"}₹{selectedTx.amount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="space-y-0 divide-y divide-white/[0.05]">
              {[
                { label: t("report.fieldDescription"), value: selectedTx.description },
                { label: t("report.fieldPerformedBy"), value: selectedTx.performedBy?.name },
                { label: t("report.fieldReference"),   value: selectedTx.referenceModel },
                { label: t("report.fieldDate"),        value: selectedTx.createdAt },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-6 py-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 shrink-0 pt-0.5">{label}</span>
                  <span className="text-[13px] text-white/60 text-right" translate="no">{value ?? "—"}</span>
                </div>
              ))}
            </div>
          </DetailModal>
        );
      })()}

      {/* ── Event detail modal ── */}
      {selectedEvent && (() => {
        const cfg = eventConfig[selectedEvent.eventType] ?? { label: selectedEvent.eventType, color: "#94a3b8", icon: null };
        const meta = selectedEvent.metadata || {};
        const metaEntries = Object.entries(meta).filter(([k]) => k !== "__v");
        return (
          <DetailModal isOpen title={t("report.activityDetail")} onClose={() => setSelectedEvent(null)}>
            <div className="mb-5 pb-5 border-b border-white/[0.06]">
              <span
                className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-lg border mb-3"
                style={{ background: cfg.color + "15", borderColor: cfg.color + "35", color: cfg.color }}
              >
                {t(`events.${selectedEvent.eventType}`)}
              </span>
              <p className="text-sm font-medium text-white/70 leading-snug" translate="no">{meta.note || t("report.groupActivity")}</p>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {[
                { label: t("report.fieldPerformedBy"), value: selectedEvent.performedBy?.name },
                { label: t("report.fieldDate"),        value: selectedEvent.createdAt },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-6 py-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 shrink-0 pt-0.5">{label}</span>
                  <span className="text-[13px] text-white/60 text-right" translate="no">{value ?? "—"}</span>
                </div>
              ))}
              {metaEntries.length > 0 && (
                <div className="pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">{t("report.fieldDetails")}</p>
                  <div className="space-y-1.5">
                    {metaEntries.map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-4">
                        <span className="text-[11px] text-white/30 capitalize">{k}</span>
                        <span className="text-[11px] text-white/50 text-right font-mono break-all" translate="no">
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

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
