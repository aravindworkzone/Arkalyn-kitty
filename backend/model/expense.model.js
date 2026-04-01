const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
    groupId: {type: mongoose.Schema.Types.ObjectId, ref: "group", required: true},
    category: {type: mongoose.Schema.Types.ObjectId, ref: "category", required: true},
    title: {type: String, required: true},
    amount: {type: Number, required: true, min: [0.01, "Amount must be positive"]},
    splitBetween: {
        type: [
            {
                userId: {type: mongoose.Schema.Types.ObjectId, ref: "user", required: true},
                amount: {type: Number, required: true, min: [0.01, "Amount must be positive"]}
            }
        ],
        validate: {
            validator: function (value) {
                const totalSplit = value.reduce((sum, split) => sum + split.amount, 0);
                return value.length > 0 && Math.abs(totalSplit - this.amount) < 0.01;
            },
            message: "Enter valid split amounts"
        }
    },
    paidBy: {type: mongoose.Schema.Types.ObjectId, ref: "user", required: true},
    paymentType: {type: String, enum: ["cash", "card", "online"], required: true},
    date: {type: Date, required: true, default: Date.now}
}, {timestamps: true});

module.exports = mongoose.model("expense", expenseSchema);