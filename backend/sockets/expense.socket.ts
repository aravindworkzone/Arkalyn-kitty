import type { AppIO, AppSocket } from './group.socket';

/**
 * Expense-specific socket handlers live here. Currently a no-op stub —
 * server-to-client expense events are emitted from services via emitToGroup
 * (see sockets/index.ts), and there are no client-initiated expense events yet.
 */
export const registerExpenseHandlers = (_io: AppIO, _socket: AppSocket): void => {
    // intentionally empty — expand when the client needs to drive expense flows
};
