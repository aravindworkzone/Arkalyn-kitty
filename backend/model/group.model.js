const mongoose = require("mongoose");
const Counter = require("./counter.model");

const groupSchema = new mongoose.Schema({
    displayId: {type: String},
    name: {type: String, required: true},
    members: [{
        _id: false,
        user: {type: mongoose.Schema.Types.ObjectId, ref: "user", required: true},
        amount: {type: Number, default: 0}
    }],
    admin: [{type: mongoose.Schema.Types.ObjectId, ref: "user", required: true}],
    superAdmin: {type: mongoose.Schema.Types.ObjectId, ref: "user", required: true},
}, {timestamps: true});

groupSchema.index({ "members.user": 1, _id: 1 }, { unique: true });

groupSchema.pre("findOneAndDelete", async function() {
    try {
        const groupId = this.getQuery()["_id"];
        if(!groupId) return;
        await mongoose.model("expense").deleteMany({ groupId });
        await mongoose.model("category").deleteMany({ groupId });
    } catch (error) {
        throw new Error(error.message);
    }
});

groupSchema.pre("save", async function () {
    try {
        const year = new Date().getFullYear().toString().slice(-2);
        const key = `Grp-${year}`;
    
        const counter = await Counter.findOneAndUpdate(
            { _id: key },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        console.log('Counter updated:', counter);

        const id = `${key}-${String(counter.seq).padStart(3, "0")}`;
        this.displayId = id;
    } catch (error) {
        throw new Error(error.message);
    }
});


module.exports = mongoose.model("group", groupSchema);