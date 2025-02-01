const router = require("express").Router();

const { createOrder, getLastOrderDetail, getMyOrders, getAllConfirmedOrder, getAllPendingOrders } = require("../controllers/orderController");

const { isAutheticatedUser } = require("../middlewares/isAuthenticatedUser");

//Product Routes
router.route("/order/create").post(isAutheticatedUser, createOrder);
router.route('/order/lastorder').get(isAutheticatedUser, getLastOrderDetail);
router.route('/order/getMyOrders').get(isAutheticatedUser, getMyOrders)
// router.route("/payment/callback/phonepay/:merchantTransactionId").get(paymentController);


//Admin Route
router.route('/admin/order/pending').get(getAllPendingOrders);
router.route('/admin/order/success').get(getAllConfirmedOrder);

module.exports = router;
