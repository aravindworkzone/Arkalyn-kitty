import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Chip } from "../ui";
import SidebarSection from "./SidebarSection";
import { addDays, toISODate } from "../../helpers/date";
import { useGetCategoriesQuery } from "../../redux/api/category";
import { useGetGroupMembersQuery } from "../../redux/api/group";

/**
 * In-group filters: category, member, date range.
 *
 * These write the EXACT search params page/AllExpensesPage.tsx already reads —
 * categoryId, paidBy, spender, startDate, endDate, label — so there is no new
 * filtering layer anywhere. Setting a filter here just navigates to the group's
 * expenses list with the params it already understands, which also means the
 * resulting URL is shareable and survives a refresh.
 *
 * Chips rather than <Select>: the sidebar's middle is an `overflow-y-auto`
 * column, and Select's panel is absolutely positioned rather than portalled —
 * its own docblock flags clipping in exactly that situation. Chips also let a
 * category carry its stored colour, which Select rows cannot.
 */

interface SidebarGroupFiltersProps {
    groupId: string;
    collapsed?: boolean;
    onNavigate?: () => void;
}

export default function SidebarGroupFilters({ groupId, collapsed, onNavigate }: SidebarGroupFiltersProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const { data: categories = [] } = useGetCategoriesQuery(groupId, { skip: !groupId });
    const { data: members = [] } = useGetGroupMembersQuery(groupId, { skip: !groupId });

    const activeCategory = params.get("categoryId");
    const activeSpender = params.get("spender");
    const activeStart = params.get("startDate");

    // Collapsed rail has no room for filter chips, and a filter you cannot read
    // is worse than one you cannot reach.
    if (collapsed) return null;

    const apply = (next: Record<string, string | null>) => {
        const search = new URLSearchParams();
        // Start from what's already applied so filters compose instead of
        // replacing one another.
        for (const key of ["categoryId", "paidBy", "spender", "startDate", "endDate", "label"]) {
            const v = params.get(key);
            if (v) search.set(key, v);
        }
        for (const [key, value] of Object.entries(next)) {
            if (value === null) search.delete(key);
            else search.set(key, value);
        }
        navigate(`/groups/${groupId}/expenses?${search.toString()}`);
        onNavigate?.();
    };

    const datePresets: { id: string; label: string; days: number }[] = [
        { id: "7", label: t("sidebar.last7", "7 days"), days: 7 },
        { id: "30", label: t("sidebar.last30", "30 days"), days: 30 },
    ];

    const chipClass = "px-2.5 py-1 text-theme-2xs max-w-full";

    return (
        <SidebarSection title={t("sidebar.filters", "Filters")} collapsed={false} defaultOpen={false}>
            <div className="px-2.5 pb-2 space-y-3">
                {categories.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-theme-2xs font-medium text-fg-subtle">
                            {t("sidebar.byCategory", "By category")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {categories.map((c) => (
                                <Chip
                                    key={c._id}
                                    accentColor={c.color}
                                    selected={activeCategory === c._id}
                                    onClick={() =>
                                        apply(
                                            activeCategory === c._id
                                                ? { categoryId: null, label: null }
                                                : { categoryId: c._id, label: c.name }
                                        )
                                    }
                                    className={chipClass}
                                >
                                    <span className="truncate">{c.name}</span>
                                </Chip>
                            ))}
                        </div>
                    </div>
                )}

                {members.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-theme-2xs font-medium text-fg-subtle">
                            {t("sidebar.byMember", "By member")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {members.map((m) => (
                                <Chip
                                    key={m._id}
                                    selected={activeSpender === m.userId._id}
                                    onClick={() =>
                                        apply(
                                            activeSpender === m.userId._id
                                                ? { spender: null }
                                                : { spender: m.userId._id }
                                        )
                                    }
                                    className={chipClass}
                                >
                                    <span className="truncate" translate="no">{m.userId.name}</span>
                                </Chip>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-1.5">
                    <p className="text-theme-2xs font-medium text-fg-subtle">
                        {t("sidebar.byDate", "By date")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {datePresets.map((p) => {
                            const from = toISODate(addDays(new Date(), -p.days));
                            const selected = activeStart === from;
                            return (
                                <Chip
                                    key={p.id}
                                    selected={selected}
                                    onClick={() =>
                                        apply(
                                            selected
                                                ? { startDate: null, endDate: null }
                                                : { startDate: from, endDate: toISODate(new Date()) }
                                        )
                                    }
                                    className={chipClass}
                                >
                                    {p.label}
                                </Chip>
                            );
                        })}
                    </div>
                </div>
            </div>
        </SidebarSection>
    );
}
