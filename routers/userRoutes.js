const router = require("express").Router();

const { getUserDetails, verifyOTP, registerUser, logoutController, addNewUserToNewsLetter,submitUserContactForm,verifyGoogleOAuthController, addNewAddress, deleteAddress, editAddress } = require("../controllers/userController");

const { isAutheticatedUser } = require("../middlewares/isAuthenticatedUser");

//User Authentication Routes
router.route('/auth/verifyotp').post(verifyOTP)
router.route('/auth/register').post(registerUser)
router.route('/auth/logout').get(logoutController)
router.route('/auth/callback/google').get(verifyGoogleOAuthController)


//User Detail Route
router.route('/auth/me').get(isAutheticatedUser, getUserDetails)


//for add New Address
router.route('/update/address').post(isAutheticatedUser, addNewAddress)
router.route('/update/address/delete').post(isAutheticatedUser, deleteAddress)
router.route('/update/address/edit').post(isAutheticatedUser, editAddress)


//Contact Form
router.route('/contact/support').post(submitUserContactForm)
router.route('/newsletter/user').post(addNewUserToNewsLetter)

module.exports = router;

