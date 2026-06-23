import mongoose , { Document, Schema } from 'mongoose';

// Categories come in two flavours that share this collection:
//   EXPENSE — what an expense is spent on (the original behaviour).
//   CREDIT  — what bucket a credit/contribution belongs to.
// Pre-existing documents have no `type` field, so expense-side queries match
// on `{ type: { $ne: "CREDIT" } }` rather than `{ type: "EXPENSE" }`.
export const CATEGORY_TYPES = ["EXPENSE", "CREDIT"] as const;
export type CategoryType = typeof CATEGORY_TYPES[number];

export interface ICategory extends Document {
    groupId: mongoose.Types.ObjectId;
    name: string;
    color: string;
    type: CategoryType;
    // Special / "collective" categories (e.g. a family EMI) are excluded from
    // the per-member paid/spent breakdown and surfaced as their own bucket.
    // Expense-only concept.
    isSpecial?: boolean;
    isDeleted?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const categorySchema = new Schema<ICategory>({
    groupId: {type: mongoose.Types.ObjectId, ref: "Group"},
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#f97316" },
    type: { type: String, enum: CATEGORY_TYPES, default: "EXPENSE" },
    isSpecial: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false }
}, {timestamps: true});

// Name is unique per (group, type) — so a group may have an expense "Other"
// and a credit "Other" side by side.
categorySchema.index(
    { groupId: 1, type: 1, name: 1 },
    { unique: true, partialFilterExpression: { isDeleted: false } }
);

categorySchema.pre("findOneAndDelete", async function() {
    const categoryId = this.getQuery()["_id"];
    // Block deletion while anything still references the category. A CREDIT
    // category is referenced by credit transactions (and any expense that
    // spends from it); an EXPENSE category by expenses.
    const category = await mongoose.model("Category").findById(categoryId).lean<{ type?: string }>();
    if (category?.type === "CREDIT") {
        const credit = await mongoose.model("GroupTransaction").findOne({
            category: categoryId,
            action: "CREDIT",
            isDeleted: false,
        });
        if (credit) throw new Error("Cannot delete category with existing credits");
        const spend = await mongoose.model("Expense").findOne({ creditCategory: categoryId, isDeleted: false });
        if (spend) throw new Error("Cannot delete category with existing credits");
    } else {
        const expense = await mongoose.model("Expense").findOne({ category: categoryId, isDeleted: false });
        if (expense) throw new Error("Cannot delete category with existing expenses");
    }
});

export default mongoose.model<ICategory>("Category", categorySchema);