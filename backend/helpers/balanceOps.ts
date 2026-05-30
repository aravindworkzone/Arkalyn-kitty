import mongoose, { ClientSession } from "mongoose";
import Group from "../models/group.model";
import GroupMember from "../models/group_member.model";
import { toDBAmount } from "./Money";

/**
 * Centralized money mutations for the group wallet and member contributions.
 *
 * Why this exists — two easy-to-get-wrong rules live here, in ONE place:
 *
 *  1. Money fields (`balance`, `totalContribution`, member `contribution`) carry
 *     a Mongoose `set: toDBAmount` getter/setter. Mongoose RE-RUNS that setter on
 *     `$inc`/`$set`, so update operators must receive RAW RUPEES — never
 *     `toDBAmount(x)`, or the value is converted twice (×100).
 *  2. Query filters do NOT run setters, so a `$gte` balance comparison must use
 *     `toDBAmount(x)` to compare against the cents stored in the DB.
 *
 * Services should call these helpers instead of hand-writing `$inc`/`$gte`, so
 * the double-conversion bug cannot reappear. All `rupees` arguments are in
 * display units (rupees); conversion to cents happens via the schema setter.
 */

type Id = mongoose.Types.ObjectId | string;
interface SessionOpt {
    session?: ClientSession;
}

/**
 * Add money to the wallet (e.g. a contribution). By default also bumps
 * `totalContribution`; pass `trackContribution: false` for credits that should
 * not count toward lifetime contributions (rare).
 */
export const creditGroupBalance = async (
    groupId: Id,
    rupees: number,
    { session, trackContribution = true }: SessionOpt & { trackContribution?: boolean } = {}
) => {
    const inc: Record<string, number> = { balance: rupees };
    if (trackContribution) inc.totalContribution = rupees;
    return Group.findByIdAndUpdate(groupId, { $inc: inc }, { new: true, session });
};

/**
 * Atomically remove money from the wallet, refusing to overspend. Returns the
 * updated group, or `null` when the balance was insufficient (caller throws).
 */
export const debitGroupBalance = async (groupId: Id, rupees: number, { session }: SessionOpt = {}) => {
    return Group.findOneAndUpdate(
        { _id: groupId, balance: { $gte: toDBAmount(rupees) } },
        { $inc: { balance: -rupees } },
        { new: true, session }
    );
};

/**
 * Refund money back to the wallet (e.g. on expense deletion). Does not touch
 * `totalContribution` — the original contribution still happened.
 */
export const refundGroupBalance = async (groupId: Id, rupees: number, { session }: SessionOpt = {}) => {
    return Group.findByIdAndUpdate(groupId, { $inc: { balance: rupees } }, { new: true, session });
};

/**
 * Reverse a credit: pull both the money and its contribution back out, atomic
 * and never negative. Returns `null` if the funds were already spent.
 */
export const reverseGroupCredit = async (groupId: Id, rupees: number, { session }: SessionOpt = {}) => {
    return Group.findOneAndUpdate(
        { _id: groupId, balance: { $gte: toDBAmount(rupees) } },
        { $inc: { balance: -rupees, totalContribution: -rupees } },
        { new: true, session }
    );
};

/**
 * Adjust a member's running contribution total by a signed rupee amount.
 * `includeLeft` also corrects soft-deleted (left) members — used when reversing
 * a credit so a departed contributor's total is still rolled back.
 */
export const adjustMemberContribution = async (
    groupId: Id,
    userId: Id,
    rupees: number,
    { session, includeLeft = false }: SessionOpt & { includeLeft?: boolean } = {}
) => {
    const filter: Record<string, unknown> = { groupId, userId };
    if (!includeLeft) filter.isDeleted = false;
    return GroupMember.findOneAndUpdate(filter, { $inc: { contribution: rupees } }, { new: true, session });
};
