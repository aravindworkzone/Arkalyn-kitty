import type { GroupPurpose } from "../models/group.model";
import type { CategoryType } from "../models/category.model";

export interface DefaultCategory {
    name: string;
    color: string;
    isSpecial?: boolean;
    // Which side of the ledger this bucket belongs to. Omitted means EXPENSE,
    // which is what every purpose but RESERVE wants.
    type?: CategoryType;
}

export const PURPOSE_DEFAULT_CATEGORIES: Record<GroupPurpose, DefaultCategory[]> = {
    FAMILY: [
        { name: "Family", color: "#6366f1", isSpecial: true },
        { name: "Groceries", color: "#10b981" },
        { name: "Utilities", color: "#06b6d4" },
        { name: "Rent/EMI", color: "#f59e0b" },
        { name: "Healthcare", color: "#ef4444" },
        { name: "Transport", color: "#8b5cf6" },
    ],
    FRIENDS: [
        { name: "Food & Dining", color: "#f97316" },
        { name: "Travel", color: "#06b6d4" },
        { name: "Entertainment", color: "#8b5cf6" },
        { name: "Shopping", color: "#ec4899" },
    ],
    ROOMMATES: [
        { name: "Rent", color: "#f59e0b" },
        { name: "Utilities", color: "#06b6d4" },
        { name: "Groceries", color: "#10b981" },
        { name: "Household", color: "#8b5cf6" },
        { name: "Internet", color: "#6366f1" },
    ],
    TEAM: [
        { name: "Meals", color: "#f97316" },
        { name: "Travel", color: "#06b6d4" },
        { name: "Supplies", color: "#10b981" },
        { name: "Events", color: "#ec4899" },
    ],
    // A Reserve group cannot record expenses, so these are CREDIT buckets — they
    // label where incoming money came from, not what it was spent on. They were
    // always named that way ("Savings", "Emergency Fund"); they were merely
    // seeded on the wrong side of the ledger before the type meant anything.
    //
    // Category names are unique per (group, type), so none of these collides with
    // the "Other" credit category every group gets automatically.
    RESERVE: [
        { name: "Personal Funds", color: "#f97316", type: "CREDIT" },
        { name: "Savings", color: "#06b6d4", type: "CREDIT" },
        { name: "Emergency Fund", color: "#ef4444", type: "CREDIT" },
        { name: "Family Funds", color: "#8b5cf6", type: "CREDIT" },
        { name: "Business Funds", color: "#10b981", type: "CREDIT" },
        { name: "Shared Fund", color: "#ec4899", type: "CREDIT" },
    ],
    // Nothing. A Chit group records no expenses, so an expense starter set would
    // be six buckets nothing could ever go into — the same reason RESERVE seeds
    // CREDIT rows instead.
    //
    // It seeds no CREDIT rows either, because the two it would want already exist
    // without being named here: every group gets an "Other" credit category at
    // creation, and the first recorded contribution creates "Chit contributions"
    // through getOrCreateChitCreditCategory. Seeding them twice would collide on
    // the { groupId, type, name } unique index, and a category cannot be deleted
    // once anything references it — so a wrong guess here is permanent.
    CHIT: [],
    OTHER: [],
};
