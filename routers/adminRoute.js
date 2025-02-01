const router = require("express").Router();

const {
  getDashboardData,getAllOrders, getOrderDetail
} = require("../controllers/adminController");
const { isAutheticatedUser } = require("../middlewares/isAuthenticatedUser");

router.route("/dashboard").get(getDashboardData);
router.route("/dashboard/orders").get(getAllOrders);
router.route("/dashboard/order/:id").get(getOrderDetail);


module.exports = router;
