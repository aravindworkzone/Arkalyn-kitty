import mongoose , { Document, Schema } from 'mongoose';

interface IGroupMember extends Document {
    groupId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    contribution: number;
    role: "SUPER_ADMIN" | "ADMIN" | "MEMBER";
    settlement: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const groupMemberSchema = new Schema<IGroupMember>({
    groupId: {type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true},
    userId: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
    contribution: {type: Number, default: 0},
    role: {type: String, enum: ["SUPER_ADMIN", "ADMIN", "MEMBER"], default: "MEMBER"},
    settlement: {type: Boolean, default: false}
}, {timestamps: true});

groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IGroupMember>("GroupMember", groupMemberSchema);