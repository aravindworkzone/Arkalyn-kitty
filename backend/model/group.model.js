const mongoose = require("mongoose");
const Counter = require("./counter.model");

const groupSchema = new mongoose.Schema({
    displayId: {type: String},
    name: {type: String, required: true , trim: true, minlength: 3, maxlength: 100},
    groupType: {type: String, enum: ["POOL", "SPLIT"], default: "POOL"},
    members: [{
        _id: false,
        user: {type: mongoose.Schema.Types.ObjectId, ref: "user", required: true},
        contribution: {type: Number, default: 0},
        role: {type: String, enum: ["SUPER_ADMIN", "ADMIN", "MEMBER"], default: "MEMBER"},
        settlement: {type: Boolean, default: false}
    }],
    balance: {type: Number, default: 0},
    totalContribution: {type: Number, default: 0},
    status: {type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE"}
}, {timestamps: true});

groupSchema.pre("findOneAndDelete", async function() {
    try {
        const groupId = this.getQuery()["_id"];
        if(!groupId) return;
        await mongoose.model("expense").deleteMany({ groupId });
        await mongoose.model("category").deleteMany({ groupId });
        await mongoose.model("group_event").deleteMany({ groupId });
    } catch (error) {
        throw new Error(error.message);
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

        const id = `${key}-${String(counter.seq).padStart(3, "0")}`;
        this.displayId = id;
    } catch (error) {
        throw new Error(error.message);
    }
});


module.exports = mongoose.model("group", groupSchema);