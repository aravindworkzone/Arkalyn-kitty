export type GroupLinkStatus = "PENDING" | "ACTIVE" | "REJECTED" | "REVOKED";

/** The counterpart group, as populated by the API. */
export interface LinkedGroupRef {
    _id: string;
    name: string;
    displayId: string;
    status?: "ACTIVE" | "INACTIVE" | "CLOSED";
    /** Only populated on outgoing links — the spendable wallet of the group being funded. */
    balance?: number;
}

export interface GroupLink {
    _id: string;
    hostGroupId: LinkedGroupRef | string;
    sourceGroupId: LinkedGroupRef | string;
    status: GroupLinkStatus;
    /** Lump sums sent under the old gift model, in rupees. History only — never owed. */
    contribution: number;
    /** Most the host may owe at once, set by the Reserve. 0 = no credit yet. */
    creditLimit?: number;
    /** What the host currently owes the Reserve. */
    outstanding?: number;
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
}
