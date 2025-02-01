const router = require("express").Router();

const { createNewReview, getCurrentStock, updateCurrentStock,createCurrentStock,getProductReviews } = require("../controllers/productController");

const { isAutheticatedUser } = require("../middlewares/isAuthenticatedUser");

//Product Routes
router.route("/product/review").post(createNewReview);
router.route("/product/review/:productId").get(getProductReviews);


//Stock Routes(Internal Api Endpoint)
router.route("/stock/create").post(createCurrentStock);
router.route("/stock/available").get(getCurrentStock);
router.route("/stock/update").post(updateCurrentStock);

module.exports = router;
