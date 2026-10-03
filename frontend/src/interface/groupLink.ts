export type GroupLinkStatus = "PENDING" | "ACTIVE" | "REJECTED" | "REVOKED";

/** The counterpart group, as populated by the API. */
export interface LinkedGroupRef {
    _id: string;
    name: string;
    displayId: string;
    status?: "ACTIVE" | "INACTIVE" | "CLOSED";
    /** The counterpart's wallet. */
    balance?: number;
    /** Only on incoming links — the Reserve's fixed credit limit. */
    creditLimit?: number;
    /** Only on incoming links — what all the Reserve's borrowers owe it combined. */
    creditUsed?: number;
}

/** A Reserve's credit position, as the API resolves it. */
export interface ReserveCredit {
    /** Fixed limit set by a Reserve admin. Contributions never change it. */
    creditLimit: number;
    /** What all its Family groups owe it right now. */
    creditUsed: number;
    /** Its wallet. */
    balance: number;
    /** What it can still lend: min(limit − lent out, wallet). */
    available: number;
}

export interface GroupLink {
    _id: string;
    hostGroupId: LinkedGroupRef | string;
    sourceGroupId: LinkedGroupRef | string;
    status: GroupLinkStatus;
    /** Lump sums sent under the old gift model, in rupees. History only — never owed. */
    contribution: number;
    /** What the host currently owes the Reserve. */
    outstanding?: number;
    /** Money the host sent beyond what it owed — deposits into the Reserve. */
    deposited?: number;
    requestedBy?: { _id: string; name: string } | string;
    reviewedAt?: string | null;
    createdAt: string;
    /**
     * Incoming links only: how much of this funder's money the host has already
     * tagged onto expenses. Attribution, not a balance — it can exceed
     * `contribution`, which is what the advisory over-draw warning is for.
     */
    attributedSpend?: number;
    /**
     * Incoming links only: what this group can spend on the Reserve's credit
     * right now — min(limit − lent out, Reserve wallet), resolved by the API
     * with the same rule a spend is held to.
     */
    availableCredit?: number;
    /**
     * Outgoing links only: whether the counterpart HOST is on a plan that can
     * receive funding. The host pays for the connection, so a source group
     * cannot answer this from its own plan — the API resolves it per link with
     * the same helper the server-side gate uses.
     */
    hostCanReceive?: boolean;
}

export interface GroupLinks {
    /** Groups funding this one. */
    incoming: GroupLink[];
    /** Groups this one funds. */
    outgoing: GroupLink[];
    /** Set only when this group is a Reserve: its credit position. */
    reserveCredit?: ReserveCredit | null;
}
