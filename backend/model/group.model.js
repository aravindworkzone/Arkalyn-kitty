const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
    name: {type: String, required: true},
    members: [{type: mongoose.Schema.Types.ObjectId, ref: "user", required: true}],
    admin: [{type: mongoose.Schema.Types.ObjectId, ref: "user", required: true}]
}, {timestamps: true});

groupSchema.pre("findOneAndDelete", async function() {
    try {
        const groupId = this.getQuery()["_id"];
        await mongoose.model("expense").deleteMany({ groupId });
        await mongoose.model("category").deleteMany({ groupId });
    } catch (error) {
        throw new Error(error.message);
    }
});

module.exports = mongoose.model("group", groupSchema);