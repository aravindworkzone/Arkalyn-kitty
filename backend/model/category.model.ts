import mongoose , { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
    groupId: mongoose.Schema.Types.ObjectId;
    name: string;
    isDeleted?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const categorySchema = new Schema<ICategory>({
    groupId: {type: mongoose.Schema.Types.ObjectId, ref: "Group"},
    name: { type: String, required: true, trim: true },
    isDeleted: { type: Boolean, default: false }
}, {timestamps: true});

categorySchema.index({ groupId: 1, name: 1 }, { unique: true });
    
categorySchema.pre("findOneAndDelete", async function() {
    const categoryId = this.getQuery()["_id"];
    const expense = await mongoose.model("Expense").findOne({ category: categoryId, isDeleted: false });
    if (expense) throw new Error("Cannot delete category with existing expenses");
});

export default mongoose.model<ICategory>("Category", categorySchema);