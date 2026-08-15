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
    /** Running total the source has transferred into the host, in rupees. */
    contribution: number;
    requestedBy?: { _id: string; name: string } | string;
    reviewedAt?: string | null;
    createdAt: string;
    /**
     * Incoming links only: how much of this funder's money the host has already
     * tagged onto expenses. Attribution, not a balance — it can exceed
     * `contribution`, which is what the advisory over-draw warning is for.
     */
    attributedSpend?: number;
}

export interface GroupLinks {
    /** Groups funding this one. */
    incoming: GroupLink[];
    /** Groups this one funds. */
    outgoing: GroupLink[];
}
