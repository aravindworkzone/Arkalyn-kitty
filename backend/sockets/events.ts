export const SOCKET_EVENTS = {
    GROUP_JOIN: 'group:join',
    GROUP_LEAVE: 'group:leave',

    EXPENSE_CREATED: 'expense:created',
    EXPENSE_DELETED: 'expense:deleted',

    GROUP_BALANCE_UPDATED: 'group:balance:updated',
    GROUP_MEMBER_ADDED: 'group:member:added',
    GROUP_MEMBER_REMOVED: 'group:member:removed',
    GROUP_CONTRIBUTION_ADDED: 'group:contribution:added',
    GROUP_SETTLEMENT_COMPLETED: 'group:settlement:completed',

    ACTIVITY_EVENT: 'activity:event',
    ERROR: 'error',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

export interface GroupJoinPayload {
    groupId: string;
}

export interface GroupLeavePayload {
    groupId: string;
}

export interface ExpenseCreatedPayload {
    groupId: string;
    expenseId: string;
    amount: number;
    paidBy: string;
    title: string;
    createdBy: string;
}

export interface ExpenseDeletedPayload {
    groupId: string;
    expenseId: string;
    refundedAmount: number;
    deletedBy: string;
}

export interface GroupBalanceUpdatedPayload {
    groupId: string;
    balance: number;
    totalContribution: number;
}

export interface GroupMemberChangedPayload {
    groupId: string;
    userId: string;
    role?: string;
}

export interface ActivityEventPayload {
    groupId: string;
    eventType: string;
    metadata?: Record<string, unknown>;
    performedBy: string;
    occurredAt: string;
}

export interface ServerToClientEvents {
    [SOCKET_EVENTS.EXPENSE_CREATED]: (payload: ExpenseCreatedPayload) => void;
    [SOCKET_EVENTS.EXPENSE_DELETED]: (payload: ExpenseDeletedPayload) => void;
    [SOCKET_EVENTS.GROUP_BALANCE_UPDATED]: (payload: GroupBalanceUpdatedPayload) => void;
    [SOCKET_EVENTS.GROUP_MEMBER_ADDED]: (payload: GroupMemberChangedPayload) => void;
    [SOCKET_EVENTS.GROUP_MEMBER_REMOVED]: (payload: GroupMemberChangedPayload) => void;
    [SOCKET_EVENTS.GROUP_CONTRIBUTION_ADDED]: (payload: GroupBalanceUpdatedPayload) => void;
    [SOCKET_EVENTS.GROUP_SETTLEMENT_COMPLETED]: (payload: GroupBalanceUpdatedPayload) => void;
    [SOCKET_EVENTS.ACTIVITY_EVENT]: (payload: ActivityEventPayload) => void;
    [SOCKET_EVENTS.ERROR]: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
    [SOCKET_EVENTS.GROUP_JOIN]: (payload: GroupJoinPayload) => void;
    [SOCKET_EVENTS.GROUP_LEAVE]: (payload: GroupLeavePayload) => void;
}

export interface InterServerEvents {
    [k: string]: never;
}

export interface SocketData {
    userId: string;
    email: string;
}

export const groupRoom = (groupId: string): string => `group:${groupId}`;
