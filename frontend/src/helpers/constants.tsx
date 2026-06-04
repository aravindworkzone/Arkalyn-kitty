export const roleGrade: Record<string, string> = {
  SUPER_ADMIN: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
  ADMIN:       "border-amber-400/30 bg-amber-500/10 text-amber-300",
  MEMBER:      "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

export const roleLabel = (role: string): string =>
  role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export const colorOptions = [
  "#f97316",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
];

export const actionStyle: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CREDIT: { label: "Credit", color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
  DEBIT:  { label: "Debit",  color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  REFUND: { label: "Refund", color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
};

export const eventConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CREATE_GROUP:    { label: "Group created",    color: "#818cf8", icon: <path d="M2 7h10M7 2v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/> },
  MEMBER_ADDED:    { label: "Member added",     color: "#34d399", icon: <><circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 11c0-2.5 2-4 5-4s5 1.5 5 4M10 6l1.5 1.5L13 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></> },
  MEMBER_REMOVED:  { label: "Member removed",   color: "#f87171", icon: <><circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 11c0-2.5 2-4 5-4s5 1.5 5 4M10 7h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></> },
  MANAGE_CATEGORY: { label: "Category updated", color: "#a78bfa", icon: <path d="M2 3h4v4H2zM8 3h4v4H8zM2 9h4v4H2zM8 9h4v4H8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/> },
  CHANGE_ROLE:     { label: "Role changed",     color: "#fbbf24", icon: <path d="M2 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/> },
  CREDIT_REMOVED:     { label: "Credit removed",     color: "#f87171", icon: <path d="M2 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/> },
  EXPENSE_EDITED:  { label: "Expense edited",    color: "#38bdf8", icon: <path d="M9 2.5l2.5 2.5M2 12l1-3.5L9.5 2A1.2 1.2 0 0111 3.5L4.5 10 1 11l1-3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/> },
};
