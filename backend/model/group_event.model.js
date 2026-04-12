const mongoose = require('mongoose');

const groupEventSchema = new mongoose.Schema({
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "group", required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    eventType: { type: String, enum: ["MANAGE_MEMBER", "MANAGE_CATEGORY", "CHANGE_ROLE", "CREATE_GROUP", "CREDIT", "DEBIT", "REFUND"], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    referenceModel: { type: String, enum: ["expense", "group","category"], default: null },
    amount: { type: Number , default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

groupEventSchema.index({ groupId: 1, createdAt: -1 });
groupEventSchema.index({ groupId: 1, eventType: 1 });

module.exports = mongoose.model("group_event", groupEventSchema);
