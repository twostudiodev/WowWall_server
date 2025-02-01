const mongoose = require("mongoose");
const validator = require("validator");


const NewsLetterSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
        required : true,
        validate: [validator.isEmail, "Please Enter A Valid Email"],
    },
})

module.exports = mongoose.model("newsLetterUserTable", NewsLetterSchema);
