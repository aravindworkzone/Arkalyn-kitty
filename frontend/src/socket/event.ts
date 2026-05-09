export const SOCKET_EVENTS = {
    GROUP_JOIN: "group:join",
    GROUP_LEAVE: "group:leave",

    EXPENSE_CREATED: "expense:created",
    EXPENSE_DELETED: "expense:deleted",

    CATEGORY_CREATED: 'category:created',
    CATEGORY_DELETED: 'category:deleted',

    ERROR: "error",
} as const;