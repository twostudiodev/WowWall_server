const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  shippingInfo: {
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    pinCode: {
      type: Number,
      required: true,
    },
    receiverNumber: {
      type: Number,
      default: null
    },
  },
  contactInfo: {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: Number,
      required: true,
    }

  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: "userTable",
    required: true,
  },

  orderItems: [
    {
      _id: {
        type: String,
        required: true
      },
      name: {
        type: String,
        required: true,
      },
      discountPrice: {
        type: Number,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      slug: {
        type: String,
        required: true,
      },
    },
  ],

  paymentInfo: {
    merchantTransactionId: {
      type: String,
    },
    status: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
    },
    transactionId: {
      type: String,
      default: null,
    }
  },
  paymentMethod: {
    type: String,
    default: null
  },
  paymentRequestedAt: {
    type: Date,
  },
  paymentReceivedAt: {
    type: Date,
    default: null,
  },

  orderStatus: {
    type: String,
    default: 'Confirmed'
  },

  totalQuantity: {
    type: Number,
    default: 0
  },

  isDiscountApplied: {
    type: String,
    default: 'False'
  }
});

module.exports = mongoose.model("orderTable", orderSchema);
