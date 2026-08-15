import type { GroupPurpose } from "../models/group.model";

export interface DefaultCategory {
    name: string;
    color: string;
    isSpecial?: boolean;
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
    RESERVE: [
        { name: "Personal Funds", color: "#f97316" },
        { name: "Savings", color: "#06b6d4" },
        { name: "Emergency Fund", color: "#ef4444" },
        { name: "Family Funds", color: "#8b5cf6" },
        { name: "Business Funds", color: "#10b981" },
        { name: "Shared Fund", color: "#ec4899" },
    ],
    OTHER: [],
};
