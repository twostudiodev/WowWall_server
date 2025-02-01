const router = require("express").Router();

const { paymentController,verifyPhonePayCallback, verifyServerToServerCallBack } = require("../controllers/paymentController");

const { isAutheticatedUser } = require("../middlewares/isAuthenticatedUser");

//Product Routes
router.route("/payment/pay").post(paymentController);
router.route("/payment/callback/:merchantTransactionId").post(verifyPhonePayCallback);
router.route("/payment/server").post(verifyServerToServerCallBack);

module.exports = router;