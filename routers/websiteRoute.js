const { submitResponseFromWebsite,sendEmailFromWebsite } = require("../controllers/websiteController");

const router = require("express").Router();



router.route("/client/contact").post(submitResponseFromWebsite);
router.route("/service/sendmail").post(sendEmailFromWebsite);


module.exports = router;