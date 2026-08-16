import mongoose from 'mongoose';
import Category, { CategoryType } from '../models/category.model';
import GroupEvent from '../models/group_event.model';
import Expense from '../models/expense.model';
import GroupTransaction from '../models/group_transaction.model';
import { AppError } from '../helpers/AppError';
import { getGroupPlan, assertWithinLimit } from '../helpers/planLimits';

// The default credit category every group gets. New credits land here unless a
// specific credit category is chosen.
export const OTHER_CREDIT_CATEGORY = { name: 'Other', color: '#64748b' } as const;

// Mongo filter fragment for "expense-side" categories. Pre-existing documents
// have no `type` field, so we match on NOT credit rather than == expense.
export const EXPENSE_CATEGORY_FILTER = { type: { $ne: 'CREDIT' } } as const;

// Fetch (or lazily create) a group's "Other" credit category. Used by every
// credit-creation flow so older groups get one on first use.
export const getOrCreateOtherCreditCategory = async (
    groupId: mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
) => {
    const query = Category.findOne({
        groupId,
        type: 'CREDIT',
        name: OTHER_CREDIT_CATEGORY.name,
        isDeleted: false,
    });
    if (session) query.session(session);
    let category = await query;
    if (!category) {
        const created = await Category.create(
            [{ groupId, type: 'CREDIT', name: OTHER_CREDIT_CATEGORY.name, color: OTHER_CREDIT_CATEGORY.color }],
            session ? { session } : {}
        );
        category = created[0]!;
    }
    return category;
};

// A spend limit only means something on the expense side, and 0 is how the
// client says "no limit" — normalise both to null.
const normaliseLimit = (limitCents: number | null | undefined, type: CategoryType) => {
    if (limitCents === undefined) return undefined;
    if (type === 'CREDIT') return null;
    return limitCents && limitCents > 0 ? Math.round(limitCents) : null;
};

export const createCategoryService = async (data: {
    name: string;
    groupId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    color?: string;
    type?: CategoryType;
    limitCents?: number | null;
}) => {
    const { groupId, userId, name, color } = data;
    const type: CategoryType = data.type === 'CREDIT' ? 'CREDIT' : 'EXPENSE';
    const typeFilter = type === 'CREDIT' ? { type: 'CREDIT' } : EXPENSE_CATEGORY_FILTER;
    const limitCents = normaliseLimit(data.limitCents, type) ?? null;

    // Collapse internal whitespace so "test  name" and "test name" can't both
    // exist — the { groupId, type, name } unique index only catches exact matches.
    const cleanName = name.replace(/\s+/g, ' ').trim();

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const existing = await Category.findOne({ groupId, ...typeFilter, name: cleanName, isDeleted: false }).session(session);
        if (existing) throw new AppError('Category already exists', 409);

        // Subscription gate: cap categories per group on the owner's tier.
        // Counted per type so credit categories don't eat the expense allowance.
        const groupPlan = await getGroupPlan(groupId, session);
        const categoryCount = await Category.countDocuments({ groupId, ...typeFilter, isDeleted: false }).session(session);
        assertWithinLimit(
            categoryCount,
            groupPlan.limits.maxCategoriesPerGroup,
            `This group has reached its ${groupPlan.config.name}-plan category limit (${groupPlan.limits.maxCategoriesPerGroup}). Upgrade this group's plan to add more.`
        );

        const categorySave = new Category({ name: cleanName, groupId, color, type, limitCents });
        await categorySave.save({ session });

        const event = await GroupEvent.create(
            [{
                groupId,
                performedBy: userId,
                eventType: "MANAGE_CATEGORY",
                metadata: {
                    userId,
                    note: limitCents
                        ? `Created category: ${cleanName} (limit ₹${limitCents / 100})`
                        : `Created category: ${cleanName}`,
                },
                referenceId: categorySave._id,
                referenceModel: "Category",
            }],
            { session }
        );

        await session.commitTransaction();
        return { category: categorySave, event };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const updateCategoryService = async (data: {
    categoryId: string;
    groupId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    color?: string;
    isSpecial?: boolean;
    limitCents?: number | null;
}) => {
    const { categoryId, groupId, userId, color, isSpecial } = data;

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const category = await Category.findOne({ _id: categoryId, groupId, isDeleted: false }).session(session);
        if (!category) throw new AppError('Category not found', 404);

        const changes: string[] = [];
        if (color !== undefined && color !== category.color) {
            changes.push(`colour ${category.color} → ${color}`);
            category.color = color;
        }
        if (isSpecial !== undefined && isSpecial !== Boolean(category.isSpecial)) {
            changes.push(isSpecial ? "marked collective" : "unmarked collective");
            category.isSpecial = isSpecial;
        }
        const limitCents = normaliseLimit(data.limitCents, (category.type ?? 'EXPENSE') as CategoryType);
        if (limitCents !== undefined && limitCents !== (category.limitCents ?? null)) {
            changes.push(
                limitCents === null
                    ? 'removed spend limit'
                    : `spend limit → ₹${limitCents / 100}`
            );
            category.limitCents = limitCents;
        }

        await category.save({ session });

        const event = await GroupEvent.create(
            [{
                groupId,
                performedBy: userId,
                eventType: "MANAGE_CATEGORY",
                metadata: {
                    userId,
                    note: changes.length
                        ? `Updated category "${category.name}" (${changes.join(", ")})`
                        : `Updated category "${category.name}"`,
                },
                referenceId: category._id,
                referenceModel: "Category",
            }],
            { session }
        );

        await session.commitTransaction();
        return { category, event };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const deleteCategoryService = async (data: {
    categoryId: string;
    userId: mongoose.Types.ObjectId;
    groupId: mongoose.Types.ObjectId;
}) => {
    const categoryId = new mongoose.Types.ObjectId(data.categoryId);

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const category = await Category.findByIdAndDelete(categoryId, { session });
        if (!category) throw new AppError('Category not found', 404);

        await GroupEvent.create(
            [{
                groupId: data.groupId,
                performedBy: data.userId,
                eventType: "MANAGE_CATEGORY",
                metadata: { userId: data.userId, note: `Deleted category: ${category.name}` },
                referenceId: categoryId,
                referenceModel: "Category",
            }],
            { session }
        );

        await session.commitTransaction();
        return category;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const getCategoryDetailsService = async (
    groupId: mongoose.Types.ObjectId,
    type: CategoryType = 'EXPENSE'
) => {
    const isCredit = type === 'CREDIT';
    const typeFilter = isCredit ? { type: 'CREDIT' } : EXPENSE_CATEGORY_FILTER;

    const categories = await Category.find({ groupId, ...typeFilter, isDeleted: false })
        .select('_id name color isSpecial type limitCents')
        .sort({ createdAt: -1 })
        .lean();

    const ids = categories.map((c) => c._id);

    // Usage count = expenses (EXPENSE) or credit transactions (CREDIT) that
    // reference the category. Drives the delete-blocked state on the client.
    // Both sides also total the money that flowed through the category, so every
    // row can show an amount and not just a count — aggregation skips Mongoose
    // getters, so the sums are genuinely in cents.
    const counts = isCredit
        ? await GroupTransaction.aggregate([
              { $match: { category: { $in: ids }, action: 'CREDIT', isDeleted: false } },
              { $group: { _id: '$category', count: { $sum: 1 }, spentCents: { $sum: '$amount' } } },
          ])
        : await Expense.aggregate([
              { $match: { category: { $in: ids }, isDeleted: false } },
              { $group: { _id: '$category', count: { $sum: 1 }, spentCents: { $sum: '$amount' } } },
          ]);

    const countMap = new Map<string, number>(
        counts.map((c) => [c._id.toString(), c.count])
    );
    const spentMap = new Map<string, number>(
        counts.map((c) => [c._id.toString(), c.spentCents ?? 0])
    );

    return categories
        .map((c) => ({
            _id: c._id,
            name: c.name,
            color: c.color,
            type: (c.type ?? 'EXPENSE') as CategoryType,
            isSpecial: Boolean(c.isSpecial),
            // `expenseCount` is the generic usage count (credits, for credit
            // categories) — kept under this name so the client stays uniform.
            expenseCount: countMap.get(c._id.toString()) ?? 0,
            // Lifetime money through this category — spend for EXPENSE, credited
            // total for CREDIT. Same naming compromise as `expenseCount` above,
            // so the client renders both lists from one shape.
            spentCents: spentMap.get(c._id.toString()) ?? 0,
            // Soft limits are expense-only; a credit category caps nothing.
            limitCents: isCredit ? null : c.limitCents ?? null,
        }))
        .sort((a, b) => b.expenseCount - a.expenseCount);
};
