import { useTranslation } from "react-i18next";
import { Chip } from "../ui";

/**
 * Active / Closed / Manage.
 *
 * These are FILTERS, not a partition — "Manage" is a subset of "Active" (a
 * group you admin is also an active group), which is exactly why they are chips
 * over one list rather than three sections listing groups. The counts match
 * what page/GroupPage.tsx used to render as stat boxes.
 *
 * Selecting the active chip again clears it, so the filter never becomes a trap
 * with no visible way out.
 */

export type GroupFilter = "active" | "closed" | "manage";

interface SidebarFilterChipsProps {
    value: GroupFilter | null;
    onChange: (next: GroupFilter | null) => void;
    counts: Record<GroupFilter, number>;
}

export default function SidebarFilterChips({ value, onChange, counts }: SidebarFilterChipsProps) {
    const { t } = useTranslation();

    const chips: { id: GroupFilter; label: string }[] = [
        { id: "active", label: t("groups.activeGroups", "Active") },
        { id: "closed", label: t("groups.closedGroups", "Closed") },
        { id: "manage", label: t("groups.youManage", "Manage") },
    ];

    return (
        <div className="flex flex-wrap gap-1.5 px-2.5 pb-1">
            {chips.map((c) =>
                counts[c.id] > 0 ? (
                    <Chip
                        key={c.id}
                        selected={value === c.id}
                        onClick={() => onChange(value === c.id ? null : c.id)}
                        className="px-2.5 py-1 text-theme-2xs"
                    >
                        {c.label}
                        <span className="text-fg-subtle" translate="no">
                            {counts[c.id]}
                        </span>
                    </Chip>
                ) : null
            )}
        </div>
    );
}
