import mongoose, { type ClientSession } from 'mongoose';
import { AppError } from './AppError';
import ChitScheme from '../models/chit_scheme.model';

type Id = mongoose.Types.ObjectId | string;

/**
 * Rules about how a running chit constrains the rest of the group.
 *
 * One home for each, because both are called from several places in
 * group.service.ts and groupClose.service.ts and would otherwise drift.
 */

// The group's live scheme, or null. DRAFT does not count as live: nothing has
// been collected and no order is frozen, so a draft blocks nothing.
export const findActiveChit = async (groupId: Id, session?: ClientSession) =>
    ChitScheme.findOne({ groupId, status: 'ACTIVE', isDeleted: false })
        .select('_id totalCycles participants')
        .session(session ?? null);

/**
 * A group running a chit cannot be closed.
 *
 * Closing refunds each member in proportion to `member.contribution`, and mid-chit
 * that is simply wrong: a member who has already taken their pot has the same
 * contribution as one who has not, so the proportional split would refund the
 * person who was already paid. Rather than teach the close path a second refund
 * algorithm — inside the most money-critical file in the app — the chit has to be
 * finished or cancelled first.
 */
export const assertNoActiveChit = async (groupId: Id, session?: ClientSession): Promise<void> => {
    const scheme = await findActiveChit(groupId, session);
    if (scheme) {
        throw new AppError(
            'This group is running a chit. Complete or cancel it before closing the group.',
            409
        );
    }
};

/**
 * A participant in a running chit cannot leave or be removed.
 *
 * Not only the ones who have already been paid. An unprized member walking away
 * breaks the scheme's core invariant — one cycle per participant — so the
 * remaining cycles can no longer collect a full pot and somebody's turn silently
 * shrinks. The way out is to cancel the chit, which is a decision the group makes
 * together rather than one a departing member forces on it.
 */
export const assertMemberFreeOfChit = async (
    groupId: Id,
    userId: Id,
    session?: ClientSession
): Promise<void> => {
    const scheme = await findActiveChit(groupId, session);
    if (!scheme) return;

    const isParticipant = scheme.participants.some((p) => String(p.userId) === String(userId));
    if (isParticipant) {
        throw new AppError(
            'This member is part of the group\'s running chit. The chit must be completed or cancelled before they can leave.',
            409
        );
    }
};
