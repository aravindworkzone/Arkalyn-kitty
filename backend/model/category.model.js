const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    groupId: {type: mongoose.Schema.Types.ObjectId, ref: "group", required: true},
    name: { type: String, required: true, trim: true }
}, {timestamps: true});

module.exports = mongoose.model("category", categorySchema);