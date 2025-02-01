const { error, success } = require("../utils/responseWrapper");
const UserModal = require("../models/UserModal");
const axios = require("axios");
const qs = require("qs");
const AddressModal = require("../models/AddressModal");
const { getToken } = require("../utils/getToken");
const { sendEmail } = require("../utils/helperFunctions");
const NewsLetterModal = require("../models/NewsLetterModal");

exports.registerUser = async (req, res) => {
  try {
    let { email, number, isUserWantNewsLetter } = req.body;
    if (!number || !email) {
      return res.send(
        error(400, "Please provide the details. EMAIL | PHONE) ")
      );
    }

    const isAlreadyExist = await UserModal.findOne({
      $or: [{ email: { $regex: new RegExp(email, "i") } }, { number }],
    }).populate('address');


    if (isAlreadyExist) {
      // token = isAlreadyExist.getJWTToken();
      const { token, options } = getToken(isAlreadyExist);

      if (!isAlreadyExist.isProfileCompleted) {
        if (!isAlreadyExist.email) {
          isAlreadyExist.email = email;
        }
        if (!isAlreadyExist.number) {
          isAlreadyExist.number = number;
        }

        if (isAlreadyExist.number && isAlreadyExist.email) {
          isAlreadyExist.isProfileCompleted = true;
          await isAlreadyExist.save();
        }
      }

      if (isAlreadyExist?.number != number) {
        return res.send(error(400, 'Provided Number is not associated with gived id'));
      }
      if (isAlreadyExist.email.toLowerCase() != email.toLowerCase()) {
        return res.send(error(400, 'Provided Email is not associated with gived id'));
      }


      if (isUserWantNewsLetter) {
        const existingEmail = await NewsLetterModal.findOne({
          email: { $regex: new RegExp(isAlreadyExist.email, "i") },
        });

        if (!existingEmail) {
          await NewsLetterModal.create({ email: isAlreadyExist.email });
        }
      }


      res.cookie("wowwallauthtoken", token, options);
      return res.send(success(200, isAlreadyExist));
    }

    const user = await UserModal.create({
      email,
      number,
      isProfileCompleted: false,
    });


    if (isUserWantNewsLetter) {
      const existingEmail = await NewsLetterModal.findOne({
        email: { $regex: new RegExp(email, "i") },
      });

      if (!existingEmail) {
        await NewsLetterModal.create({ email });
      }
    }

    const { token, options } = getToken(user);

    res.cookie("wowwallauthtoken", token, options);
    res.send(success(200, user));
  } catch (e) {
    res.send(error(500, e.message));
  }
};



exports.verifyOTP = async (req, res) => {
  try {
    const { smsToken } = req.body;

    if (!smsToken) {
      return res.status(400).send(error(400, "SMS verification token is required."));
    }

    if (!process.env.MSG91_AUTHKEY) {
      console.error("MSG91_AUTHKEY is not defined in environment variables.");
      return res.status(500).send(error(500, "Server configuration error."));
    }

    // Verify OTP via MSG91 API
    const msg91Url = "https://control.msg91.com/api/v5/widget/verifyAccessToken";
    const responseFromMsg91 = await axios.post(msg91Url, {
      authkey: process.env.MSG91_AUTHKEY,
      "access-token": smsToken,
    });

    if (responseFromMsg91.data.type !== "success") {
      return res.status(401).send(error(401, "Failed to verify OTP."));
    }

    // Extract number and validate
    const fullNumber = responseFromMsg91.data.message;
    const extractedNumber = fullNumber.slice(2); // Exclude country code (adjust as necessary)

    if (!/^\d+$/.test(extractedNumber)) {
      return res.status(400).send(error(400, "An unexpected error occurred ."));
    }

    // Find or create user
    let user = await UserModal.findOne({ number: extractedNumber }).populate('address');
    if (!user) {
      user = await UserModal.create({ number: extractedNumber });
    }

    // Generate and set token
    const { token, options } = getToken(user);
    //clear previous token

    res.cookie("wowwallauthtoken", "", {
      ...options,
      maxAge: 0,
    });


    res.cookie("wowwallauthtoken", token, options);
    return res.status(200).send(success(200, user));
  } catch (e) {
    console.error("Error in verifyOTP:", e); // Log stack trace for debugging
    return res.status(500).send(error(500, "An unexpected error occurred."));
  }
};


exports.verifyGoogleOAuthController = async (req, res) => {
  try {
    const googleToken = req.query.code;

    if (!googleToken) {
      return res.redirect(`${process.env.REDIRECT_ORIGIN}/`);
    }

    const url = "https://oauth2.googleapis.com/token";

    const values = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: "https://api.wowwall.in/api/v1/auth/callback/google",
      grant_type: "authorization_code",
      code: googleToken,
    };

    const resp = await axios.post(url, qs.stringify(values), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    console.log("Google Token Response:", resp.data);
    if (!resp.data.access_token) {
      return res.redirect(`${process.env.REDIRECT_ORIGIN}/`);

      // return res
      //   .status(401)
      //   .json({ message: 'Failed to exchange authorization code' })
    }

    const accessToken = resp.data.access_token;

    const userInfoResponse = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${accessToken}`
    );

    if (!userInfoResponse.data) {
      console.log("No user info found");
      return res.redirect(`${process.env.REDIRECT_ORIGIN}/`);
    }

    const { email, name } = userInfoResponse.data;

    console.log("Google User Info:", userInfoResponse.data);

    let user = await UserModal.findOne({ email });
    if (!user) {
      user = await UserModal.create({
        email,
        name,
        isProfileCompleted: false,
      });
    }

    // const token = user.getJWTToken();

    // //options for cookie
    // const options = {
    //   expires: new Date(
    //     Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    //   ),
    //   httpOnly: true,
    //   sameSite: "None",
    //   secure: true,
    //   domain: 'wowwall.in',
    //   path: '/'
    // };

    const { token, options } = getToken(user);


    res.cookie("wowwallauthtoken", token, options);
    return res.redirect(`${process.env.REDIRECT_ORIGIN}/`);
  } catch (e) {
    console.error("Failed to authorize Google user", e);
    return res.redirect(`${process.env.REDIRECT_ORIGIN}/auth-error`);
  }
};

exports.logoutController = (req, res) => {
  try {
    res.clearCookie("wowwallauthtoken", {
      httpOnly: true,
      sameSite: "None",
      secure: true,
      domain: 'wowwall.in',
      path: '/'
    });

    return res.send(success(200, "Logged out successfully"));
  } catch (e) {
    return res.send(error(500, e.message));
  }
};

//Get user Detail
exports.getUserDetails = async (req, res) => {

  res.send(success(200, req.user));
};

//Create New address
exports.addNewAddress = async (req, res) => {
  try {
    const { newAddress } = req.body;

    // Required fields for address validation
    const requiredFields = [
      'firstName',
      'lastName',
      'phone',
      'address',
      'country',
      'city',
      'state',
      'pincode',
      'receiverNumber'
    ];

    // Validate for missing fields
    const missingFields = requiredFields.filter((field) => !newAddress[field]);
    if (missingFields.length > 0) {
      return res.send(
        error(
          400,
          `Missing required fields in Address: ${missingFields.join(', ')}`
        )
      );
    }

    const user = req.user;

    // Check if the user has already added 5 addresses
    const allAddresses = await AddressModal.findOne({ userId: user._id });
    console.log(allAddresses);
    if (allAddresses?.addresses.length >= 5) {
      return res.send(error(400, 'Maximum of 5 addresses are allowed'));
    }

    // Add new address to the user's address list
    const updatedAddressDocument = await AddressModal.findOneAndUpdate(
      { userId: user._id },
      {
        $push: { addresses: newAddress }, // Push the new address
      },
      { new: true, upsert: true } // Create document if it doesn't exist
    );

    // Update the user's default address reference

    // Update user's default address only if it's the first address
    if (!user.address) {
      await UserModal.findByIdAndUpdate(
        user._id,
        { address: updatedAddressDocument._id },
        { new: true }
      );
    }

    // Return success response with the updated address document
    return res.send(success(201, updatedAddressDocument));
  } catch (e) {
    console.log('Error adding new address:', e.message);
    res.send(error(500, 'Internal Server Error'));
  }
};


exports.deleteAddress = async (req, res) => {
  try {
    const { deleteAddressIndex } = req.body;
    const user = req.user;

    if (deleteAddressIndex === undefined || deleteAddressIndex < 0)
      return res.send(error(400, 'Invalid index'));

    const allAddresses = await AddressModal.findOne({ userId: user._id });

    if (!allAddresses || allAddresses.addresses.length === 0)
      return res.send(error(404, 'No addresses found'));

    if (deleteAddressIndex >= allAddresses.addresses.length)
      return res.send(error(400, 'Invalid index'));

    // Remove the address at the specified index
    allAddresses.addresses.splice(deleteAddressIndex, 1);
    await allAddresses.save();

    return res.send(success(200, 'Address deleted successfully'));
  } catch (e) {
    console.error('Error deleting address:', e.message);
    return res.send(error(500, 'Internal Server Error'));
  }
};


exports.editAddress = async (req, res) => {
  try {
    const { addressIndex, updatedAddress } = req.body;
    const user = req.user;

    // Validate the index
    if (addressIndex === undefined || addressIndex < 0)
      return res.send(error(400, 'Invalid index'));

    // Fetch the user's address document
    const allAddresses = await AddressModal.findOne({ userId: user._id });

    if (!allAddresses || allAddresses.addresses.length === 0)
      return res.send(error(404, 'No addresses found'));

    if (addressIndex >= allAddresses.addresses.length)
      return res.send(error(400, 'Invalid index'));

    allAddresses.addresses[addressIndex] = {
      ...allAddresses.addresses[addressIndex],
      ...updatedAddress,
    };

    // Save the updated document
    await allAddresses.save();

    return res.send(success(200, 'Address updated successfully'));
  } catch (e) {
    console.error('Error editing address:', e.message);
    return res.send(error(500, 'Internal Server Error'));
  }
};


exports.submitUserContactForm = async (req, res) => {
  try {
    const { name, email, subject, orderNumber, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.send(error(400, "All fields except 'orderNumber' are required."));
    }

    // Email content
    const emailContent = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      ${orderNumber ? `<p><strong>Order Number:</strong> ${orderNumber}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `;

    // Send email
    await sendEmail({
      to: process.env.HOSTINGER_EMAIL, // Replace with your Hostinger email
      from: process.env.HOSTINGER_EMAIL, // Replace with your Hostinger email
      subject: `Contact Form From WoWWall: ${subject}`,
      html: emailContent,
    });

    return res.send(success(200, "Message sent successfully!"));
  } catch (e) {
    return res.send(error(500, e.message));
  }
};

exports.addNewUserToNewsLetter = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.send(error(400, "Please enter your email address."));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.send(error(400, "Please enter a valid email address."));
    }

    await NewsLetterModal.create({
      email
    });

    return res.send(success(200, "Thank you for subscribing! You will start receiving updates from us soon."));
  } catch (e) {
    return res.send(error(500, `Something went wrong: ${e.message}`));
  }
}
