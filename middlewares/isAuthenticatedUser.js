const jwt = require('jsonwebtoken')
const User = require('../models/UserModal')
const { error } = require('../utils/responseWrapper')

exports.isAutheticatedUser = async (req, res, next) => {
  try {
    const { wowwallauthtoken } = req.cookies

    

    if (!wowwallauthtoken) {
      return res.send(error(404, 'You Need To Login To access This Resource'))
    }

    const decodedData = jwt.verify(wowwallauthtoken, process.env.JWT_SECRET)

    console.log(decodedData);
    if(!decodedData){
      return res.send(error(404,"Invalid Token"));
    }

    req.user = await User.findById(decodedData.id).populate('address');

    if(!req.user) {
      return res.send(error(404, 'You Need To Login To access This Resource'))
    }

    next()
  } catch (e) {
    //remove previous Token Cookie
    // res.clearCookie("wowwallauthtoken", {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: "None",
    // });
    return res.send(error(500, e.message))
  }
}
