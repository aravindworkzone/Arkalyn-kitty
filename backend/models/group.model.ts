import mongoose, { Document, Schema } from "mongoose";
import Counter from "./counter.model";
import { toDBAmount, fromDBAmount } from "../helpers/Money";

export interface IGroup extends Document {
    displayId: string;
    name: string;
    groupType: "POOL" | "SPLIT";
    balance: number;
    totalContribution: number;
    status: "ACTIVE" | "INACTIVE" | "CLOSED";
    createdBy: mongoose.Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const groupSchema = new Schema<IGroup>({
    displayId: {type: String, unique: true, sparse: true},
    name: {type: String, required: true , trim: true, minlength: 3, maxlength: 100},
    groupType: {type: String, enum: ["POOL", "SPLIT"], default: "POOL"},
    balance: {type: Number, default: 0, set:toDBAmount, get:fromDBAmount},
    totalContribution: {type: Number, default: 0, set:toDBAmount, get:fromDBAmount},
    status: {type: String, enum: ["ACTIVE", "INACTIVE", "CLOSED"], default: "ACTIVE"},
    createdBy: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true}
}, {timestamps: true, toJSON: { getters: true }, toObject: { getters: true }});

groupSchema.pre("findOneAndDelete", async function() {
    try {
        const groupId = this.getQuery()["_id"];
        if(!groupId) return;
        await mongoose.model("Expense").deleteMany({ groupId });
        await mongoose.model("Category").deleteMany({ groupId });
        await mongoose.model("GroupMember").deleteMany({ groupId });
        await mongoose.model("GroupEvent").updateMany({ groupId }, { $set: { isDeleted: true } });
        await mongoose.model("GroupTransaction").updateMany({ groupId }, { $set: { isDeleted: true } });
    } catch (error) {
        if(error instanceof Error) throw new Error(error.message);
        throw new Error("An unknown error occurred");
    }
});

groupSchema.pre("save", async function () {
    if (!this.isNew) return;

    try {
        const year = new Date().getFullYear().toString().slice(-2);
        const key = `Grp-${year}`;
    
        const counter = await Counter.findOneAndUpdate(
            { _id: key },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        if (!counter) throw new Error("Failed to generate group display ID");
        const id = `${key}-${String(counter.seq).padStart(3, "0")}`;
        this.displayId = id;
    } catch (error) {
        if(error instanceof Error) throw new Error(error.message);
        throw new Error("An unknown error occurred");
    }
});

export default mongoose.model<IGroup>("Group", groupSchema);