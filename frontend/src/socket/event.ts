export const SOCKET_EVENTS = {
    GROUP_JOIN: "group:join",
    GROUP_LEAVE: "group:leave",

    EXPENSE_CREATED: "expense:created",
    EXPENSE_DELETED: "expense:deleted",

    CATEGORY_CREATED: "category:created",
    CATEGORY_DELETED: "category:deleted",

    GROUP_MEMBER_ADDED: "group:member:added",
    GROUP_MEMBER_REMOVED: "group:member:removed",
    GROUP_ROLE_CHANGED: "group:role:changed",
    GROUP_CONTRIBUTION_ADDED: "group:contribution:added",
    GROUP_SETTLEMENT_COMPLETED: "group:settlement:completed",
    GROUP_DELETED: "group:deleted",

    ERROR: "error",
} as const;