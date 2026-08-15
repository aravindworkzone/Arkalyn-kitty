export interface JoinLink {
    _id: string;
    groupId: string;
    token: string;
    isActive: boolean;
    expiresAt?: string | null;
    createdBy?: { _id: string; name: string } | string;
    createdAt: string;
}

export interface JoinLinkPreview {
    group: {
        _id: string;
        name: string;
        displayId: string;
        status: "ACTIVE" | "INACTIVE" | "CLOSED";
    };
    memberCount: number;
    alreadyMember: boolean;
    /**
     * PENDING  — they were separately invited by email and haven't answered.
     * PENDING_APPROVAL — they've already asked and are in the admin queue.
     */
    pendingStatus: "PENDING" | "PENDING_APPROVAL" | null;
}
