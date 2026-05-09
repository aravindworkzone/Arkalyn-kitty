export const SOCKET_EVENTS = {
    GROUP_JOIN: 'group:join',
    GROUP_LEAVE: 'group:leave',

    EXPENSE_CREATED: 'expense:created',
    EXPENSE_DELETED: 'expense:deleted',

    CATEGORY_CREATED: 'category:created',
    CATEGORY_DELETED: 'category:deleted',

    GROUP_BALANCE_UPDATED: 'group:balance:updated',
    GROUP_MEMBER_ADDED: 'group:member:added',
    GROUP_MEMBER_REMOVED: 'group:member:removed',
    GROUP_CONTRIBUTION_ADDED: 'group:contribution:added',
    GROUP_SETTLEMENT_COMPLETED: 'group:settlement:completed',

    ACTIVITY_EVENT: 'activity:event',
    ERROR: 'error',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

export interface group{
    groupId: string
}

export interface ServerToClientEvents {
    [SOCKET_EVENTS.EXPENSE_CREATED]: (payload: string) => void;
    [SOCKET_EVENTS.EXPENSE_DELETED]: (payload: string) => void;
    [SOCKET_EVENTS.GROUP_BALANCE_UPDATED]: (payload: string) => void;
    [SOCKET_EVENTS.GROUP_MEMBER_ADDED]: (payload: string) => void;
    [SOCKET_EVENTS.GROUP_MEMBER_REMOVED]: (payload: string) => void;
    [SOCKET_EVENTS.GROUP_CONTRIBUTION_ADDED]: (payload: string) => void;
    [SOCKET_EVENTS.GROUP_SETTLEMENT_COMPLETED]: (payload: string) => void;
    [SOCKET_EVENTS.ACTIVITY_EVENT]: (payload: string) => void;
    [SOCKET_EVENTS.ERROR]: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
    [SOCKET_EVENTS.GROUP_JOIN]: (payload: string) => void;
    [SOCKET_EVENTS.GROUP_LEAVE]: (payload: string) => void;
}

export interface InterServerEvents {
    [k: string]: never;
}

export interface SocketData {
    userId: string;
    email: string;
}

export const groupRoom = (groupId: string): string => `group:${groupId}`;
