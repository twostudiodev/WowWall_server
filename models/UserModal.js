const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxLength: [30, "Name Cannot Exceed 30 Characters"],
    minLength: [4, "Name Should Have Atleast 4 Characters"],
    default: "Not Updated",
  },
  email: {
    type: String,
    unique: true,
    validate: [validator.isEmail, "Please Enter A Valid Email"],
  },

  number: {
    type: String,
  },

  isProfileCompleted: {
    type: Boolean,
  },

  couponUsed: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CouponTable",
      default: [],
    },
  ],

  address:
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AddressTable",
    default: null,
  },


  resetPasswordToken: String,
  resetPasswordExpire: Date,
});

// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) {
//     next();
//   }
//   this.password = await bcrypt.hash(this.password, 10);
// });

//JWT TOKEN
userSchema.methods.getJWTToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRATION_TIME,
  });
};

// userSchema.methods.comparePassword = async function (enteredPassword) {
//   return await bcrypt.compare(enteredPassword, this.password);
// };

// Generating Password Reset Token
userSchema.methods.getResetPasswordToken = function () {
  // Generating Token
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hashing and adding resetPasswordToken to userSchema
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model("userTable", userSchema);
