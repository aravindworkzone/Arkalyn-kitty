const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    groupId: {type: mongoose.Schema.Types.ObjectId, ref: "group"},
    name: { type: String, required: true, trim: true, unique: true },
}, {timestamps: true});

categorySchema.pre("findOneAndDelete", async function() {    
    try {
        const categoryId = this.getQuery()["_id"];
        const expense = await mongoose.model("expense").findOne({ category: categoryId });
        if (expense) {
            throw new Error("Cannot delete category with existing expenses");
        }
    } catch (error) {
        throw new Error(error.message);
    }   
});

module.exports = mongoose.model("category", categorySchema);