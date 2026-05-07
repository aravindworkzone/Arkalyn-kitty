import { createGroupService, deleteGroupService, manageMemberService, manageAdminService, addContributionService, SettlementService, getGroupByIdService, getGroupMemberService, getBasicTransactionService, getTransactionService, getEventService } from "../Service/group.service";
import { Response, Request } from "express";

export const createGroup = async (req: Request, res: Response) => {
    if(!req.user){
        return res.status(401).json({ message: "Unauthorized" });
    }

    const data = {
        name: req.body.name.trim(),
        members: req.body.members,
        superAdmin: req.user._id.toString()
    }
    try {
        const groupData = await createGroupService(data);
        return res.status(201).json({ message: "Group created", groupData });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error creating group', error: message });    
    }
}

export const deleteGroup = async (req: Request, res: Response) => {
    if (!req.group?._id) return res.status(400).json({ message: "Group not found" });
    const groupId = req.group._id.toString();
    try {
        const group = await deleteGroupService(groupId);

        return res.status(200).json({ message: "Group deleted", group });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error creating group', error: message });    
    }
}

export const manageMember = async (req: Request, res: Response) => {
    if(!req.user?._id){
        return res.status(401).json({ message: "Unauthorized" });
    }
    if(!req.group?._id){
        return res.status(400).json({ message: "Group not found" });
    }

    const data = {
        group: req.group._id,
        user: req.user._id,
        action: req.body.action as string,
        Member: req.body.Member,
        contribution: req.body.contribution as number
    }
    
    try {
        const manageMember = await manageMemberService(data);
        return res.status(200).json({ message: manageMember });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error creating group', error: message });    
    }
};

export const manageAdmin = async (req: Request, res: Response) => {
    if(!req.user?._id){
        return res.status(401).json({ message: "Unauthorized" });
    }
    if(!req.group?._id){
        return res.status(400).json({ message: "Group not found" });
    }
    const data = {
        group: req.group._id,
        user: req.user._id,
        action: req.body.action as string,
        member: req.body.member
    };
    try {
        const updated = await manageAdminService(data);
        return res.status(200).json({ message: updated });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error creating group', error: message });    
    }
};

export const addContribution = async (req: Request, res: Response) => {
        if(!req.user?._id){
        return res.status(401).json({ message: "Unauthorized" });
    }
    if(!req.group?._id){
        return res.status(400).json({ message: "Group not found" });
    }
    const data = {
        group: req.group._id,
        userId: req.body.userId ?? req.user._id,
        contribution: req.body.contribution as number
    };
    try {
        const Contribution = await addContributionService(data);
        return res.status(200).json({ message: "Contribution added", group: Contribution });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error creating group', error: message });    
    }
};

export const Settlement = async (req: Request, res: Response) => {
    if(!req.user?._id){
        return res.status(401).json({ message: "Unauthorized" });
    }
    if(!req.group?._id){
        return res.status(400).json({ message: "Group not found" });
    }
    const data = {
        group: req.group._id,
        userId: req.user._id,
        settlement: req.body.settlement as number,
        member: req.body.member,
        balance: req.group.balance
    }
    try {
        const Contribution = await SettlementService(data);
        return res.status(200).json({ s_message: "Contribution added", j_group: Contribution, b_status: true });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error creating group', error: message });    
    }
}

export const getGroupById = async (req: Request, res: Response) => {
    if(!req.group?._id){
        return res.status(400).json({ message: "Group not found" });
    }
    if(!req.user?._id){
        return res.status(400).json({ message: "User not found" });
    }
    try {
        const group = await getGroupByIdService(req.group._id, req.user?._id);
        return res.status(200).json({ message: "Group fetched", group });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error creating group', error: message });    
    }
}

export const getGroupMember = async (req: Request, res: Response) => {
    if (!req.group?._id) return res.status(400).json({ message: "Group not found" });
    try {
        const members = await getGroupMemberService(req.group._id);
        return res.status(200).json({ message: "Members fetched", members });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error fetching members', error: message });    
    }
}

export const getBasicTransaction = async (req: Request, res: Response) => {
    if (!req.group?._id) return res.status(400).json({ message: "Group not found" });
    try {
        const transactions = await getBasicTransactionService(req.group._id);
        return res.status(200).json({ message: "Transactions fetched", transactions });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error fetching transactions', error: message });    
    }
}

export const getTransaction = async (req: Request, res: Response) => {
    if (!req.group?._id) return res.status(400).json({ message: "Group not found" });
    try {
        const transactions = await getTransactionService(req.group._id);
        return res.status(200).json({ message: "Transactions fetched", transactions });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error fetching transactions', error: message });    
    }
}

export const getEvent = async (req: Request, res: Response) => {
    if (!req.group?._id) return res.status(400).json({ message: "Group not found" });
    try {
        const events = await getEventService(req.group._id);
        return res.status(200).json({ message: "Events fetched", events });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error fetching events', error: message });    
    }
}