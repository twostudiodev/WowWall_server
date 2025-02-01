const router = require("express").Router();

const {
  createNewCoupon,
  getAllCoupons,
  updateCouponStatus,
  applyCoupon
} = require("../controllers/couponController");
const { isAutheticatedUser } = require("../middlewares/isAuthenticatedUser");

router.route("/coupon/create").post(createNewCoupon);
router.route("/coupon/get").get(getAllCoupons);
router.route("/coupon/update").post(updateCouponStatus);
router.route("/coupon/apply").post(isAutheticatedUser ,applyCoupon);

module.exports = router;
