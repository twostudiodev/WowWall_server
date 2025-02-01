const mongoose = require("mongoose");

const AddressSchema = new mongoose.Schema({
  addresses: [
    {
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      apartment: {
        type: String,
        default: null
      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      pincode: {
        type: Number,
        required: true,
      },
      receiverNumber: {
        type: Number,
        // required: true,
      },
    },
  ],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserTable",
  },
});

module.exports = mongoose.model("AddressTable", AddressSchema);
