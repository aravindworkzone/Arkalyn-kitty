import { useState } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/header";
import { useGetAllCreditsQuery, useGetGroupByIdQuery } from "../redux/api/group";
import CreditDetailModal from "../components/CreditDetailModal";
import { dateLabel, timeLabel } from "../helpers/formatters";
import {
  PageBackground,
  BackButton,
  PageHeader,
  StatCard,
  SearchInput,
} from "../components/ui";
import { useTranslation } from "react-i18next";
import type { GroupCredit } from "../interface/transaction";

export default function AllCreditsPage() {
  const { groupId } = useParams();
  const { data: credits, isLoading } = useGetAllCreditsQuery(groupId!, { skip: !groupId });
  const { data: GroupDetails } = useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const [selectedCredit, setSelectedCredit] = useState<GroupCredit | null>(null);
  const [search, setSearch] = useState("");
  const { t } = useTranslation();

  const role = GroupDetails?.role as string | undefined;

  const filtered: GroupCredit[] = credits?.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.description?.toLowerCase().includes(q) ||
      c.performedBy?.name?.toLowerCase().includes(q)
    );
  }) ?? [];

  const groups: { label: string; items: GroupCredit[] }[] = [];
  const seen = new Set<string>();
  filtered.forEach((c) => {
    const label = dateLabel(c.createdAt);
    if (!seen.has(label)) {
      seen.add(label);
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1]!.items.push(c);
  });

  const total = filtered.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      <PageBackground />
      <Header />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">
        <BackButton />

        <PageHeader
          color="emerald"
          icon={
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="#6ee7b7" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          }
          label={t("allCredits.label", "Credits")}
          title={t("allCredits.title", "All Credits")}
          description={t("allCredits.description", "Every contribution credited to this group's wallet.")}
        />

        {!isLoading && (
          <div className="grid grid-cols-2 gap-2">
            <StatCard label={t("allCredits.totalCredited", "Total credited")} value={total} currency />
            <StatCard label={t("allCredits.transactions", "Transactions")} value={filtered.length} />
          </div>
        )}

        {!isLoading && (credits?.length ?? 0) > 0 && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("allCredits.searchPlaceholder", "Search by description or member")}
          />
        )}

        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, g) => (
              <div key={g} className="space-y-2">
                <div className="h-3 w-20 bg-white/[0.05] rounded animate-pulse" />
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-2 h-8 rounded-full bg-white/[0.06] animate-pulse shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 bg-white/[0.06] rounded animate-pulse w-3/4" />
                        <div className="h-2.5 bg-white/[0.04] rounded animate-pulse w-1/3" />
                      </div>
                    </div>
                    <div className="h-4 w-16 bg-white/[0.05] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {!isLoading && credits?.length === 0 && (
          <div className="text-center py-16">
            <p className="text-white/20 text-sm">{t("allCredits.noCreditsYet", "No credits yet")}</p>
          </div>
        )}

        {!isLoading && (credits?.length ?? 0) > 0 && filtered.length === 0 && search && (
          <div className="text-center py-12">
            <p className="text-white/25 text-sm">{t("allCredits.noResults", { search, defaultValue: `No results for "${search}"` })}</p>
            <button
              onClick={() => setSearch("")}
              className="mt-2 text-emerald-400 text-xs hover:text-emerald-300 active:text-emerald-300 transition-colors"
            >
              {t("allCredits.clearSearch", "Clear search")}
            </button>
          </div>
        )}

        {!isLoading && filtered.length > 0 && groups.map((group, gi) => (
          <div key={group.label} className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40" translate="no">
                {group.label}
              </p>
              <p className="text-xs font-mono text-white/30" translate="no">
                ₹{group.items.reduce((s, c) => s + c.amount, 0).toLocaleString("en-IN")}
              </p>
            </div>

            {group.items.map((credit, i) => (
              <div
                key={credit._id}
                onClick={() => setSelectedCredit(credit)}
                className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.12] active:bg-white/[0.07] active:border-white/[0.12] transition-colors"
                style={{
                  animation: "fadeSlideIn 0.22s ease forwards",
                  animationDelay: `${(gi * 3 + i) * 40}ms`,
                  opacity: 0,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-2 h-8 rounded-full shrink-0"
                    style={{
                      background: "#10b98160",
                      boxShadow: "0 0 8px #10b98140",
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white/80 truncate leading-tight" translate="no">
                      {credit.description || t("allCredits.contribution", "Contribution")}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ background: "#10b98120", color: "#34d399" }}
                        translate="no"
                      >
                        CREDIT
                      </span>
                      <span className="text-[10px] text-white/25" translate="no">· {credit.performedBy?.name}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-[15px] font-semibold font-mono text-[#e0fff0] leading-tight" translate="no">
                    +₹{credit.amount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-white/25 mt-0.5" translate="no">{timeLabel(credit.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </main>

      <CreditDetailModal
        credit={selectedCredit}
        onClose={() => setSelectedCredit(null)}
        role={role}
        groupId={groupId}
      />

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
