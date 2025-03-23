const mongoose = require("mongoose");


const FailedSchema = new mongoose.Schema({
    to: {
        type: String,
        required: true
    },

    subject: {
        type: String,
        required: true
    },

    website: {
        type: String,
        required: true
    },

    data: { type: Object, required: true },

    attempts: {
        type: Number,
        default: 0
    },

    createdAt: {
        type: Date,
        deafult: Date.now,
    }
})


module.exports = mongoose.model("FailedEmail", FailedSchema);