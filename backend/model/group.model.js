const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
    name: {type: String, required: true},
    members: {type: [mongoose.Schema.Types.ObjectId], ref: "user", required: true},
    admin: {type: [mongoose.Schema.Types.ObjectId], ref: "user", required: true}
}, {timestamps: true});

module.exports = mongoose.model("group", groupSchema);