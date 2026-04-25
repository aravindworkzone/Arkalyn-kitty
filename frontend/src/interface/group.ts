export interface IGroup {
    _id: string;
    displayId: string;
    name: string;
    groupType: "POOL" | "SPLIT";
    balance: number;
    totalContribution: number;
    status: "ACTIVE" | "INACTIVE";
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
}