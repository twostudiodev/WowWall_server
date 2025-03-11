const { submitResponseFromWebsite } = require("../controllers/websiteController");

const router = require("express").Router();



router.route("/client/contact").post(submitResponseFromWebsite);


module.exports = router;