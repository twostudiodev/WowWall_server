const { success, error } = require("../utils/responseWrapper");
const CouponModal = require("../models/CouponModal");
const UserModal = require("../models/UserModal");

exports.createNewCoupon = async (req, res) => {
  try {
    const { couponCode, description, discount, maxDiscount } = req.body;

    if (!couponCode || !description || !discount || !maxDiscount) {
      return res.send(error(400, "Missing required fields"));
    }

    //Find if Coupon Already Exist
    const isCouponExist = await CouponModal.findOne({
      couponCode: { $regex: new RegExp(couponCode, "i") },
    });
    if (isCouponExist) {
      return res.send(error(400, "Coupon Already Exist."));
    }

    await CouponModal.create({
      couponCode,
      description,
      discount,
      maxDiscount,
    });

    res.send(success(201, "Coupon Created Successfully."));
  } catch (e) {
    return res.send(error(500, e.message));
  }
};

exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await CouponModal.find({});
    res.send(success(200, coupons));
  } catch (e) {
    return res.send(error(500, e.message));
  }
};

exports.updateCouponStatus = async (req, res) => {
  try {
    const { couponCode, isActive } = req.body;

    if (!couponCode || !isActive) {
      return res.send(error(400, "Missing required fields"));
    }

    const isCouponExist = await CouponModal.findOne({
      couponCode: { $regex: new RegExp(couponCode, "i") },
    });
    if (!isCouponExist) {
      return res.send(error(400, "Coupon Does Not Exist."));
    }

    await CouponModal.findOneAndUpdate(
      { couponCode: { $regex: new RegExp(couponCode, "i") } },
      { isActive },
      { new: true }
    );
    res.send(success(200, "Coupon Updated Successfully."));
  } catch (e) {
    return res.send(error(500, e.message));
  }
};

exports.applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const user = req.user;

    if (!couponCode) {
      return res.send(error(400, "Missing couponCode fields"));
    }

    //check whether coupon exist or not
    const isCouponExist = await CouponModal.findOne({
      couponCode: { $regex: new RegExp(couponCode, "i") },
    });
    if (!isCouponExist) {
      return res.send(error(400, "Coupon Does Not Exist."));
    }

    //check whether user has already used the coupon or not
    if (user.couponUsed.includes(isCouponExist._id)) {
      return res.send(error(400, "Coupon Already Used."));
    }

    //no need to do this now , marked true once payment is done
    //push userId in couponUsed
    // await UserModal.findOneAndUpdate(
    //   { _id: user._id },
    //   { $push: { couponUsed: isCouponExist._id } },
    //   { new: true }
    // );

    // //also push the id of user in coupon
    // const updatedCoupon = await CouponModal.findOneAndUpdate(
    //   { _id: isCouponExist._id },
    //   { $push: { usersUsed: user._id } },
    //   { new: true }
    // );

    // console.log(updatedCoupon);

    return res.send(success(200, isCouponExist));
  } catch (e) {
    return res.send(error(500, e.message));
  }
};
