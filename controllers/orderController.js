const { client } = require("../config/config");
const UserModal = require("../models/UserModal");
const OrderTable = require("../models/OrderModal");
const AddressTable = require("../models/AddressModal");
const { error, success } = require("../utils/responseWrapper");
const CouponModal = require("../models/CouponModal");

const { generateMerchantTransactionId, generatePhonepayPaymentLink, generateMerchantUserId } = require("../utils/helperFunctions");
const OrderModal = require("../models/OrderModal");
const stockSchema = require("../models/stockSchema");
const NewsLetterModal = require("../models/NewsLetterModal");


exports.createOrder = async (req, res) => {
  try {
    const {
      products,
      shippingInfo,
      contactInfo,
      totalPrice,
      isDiscountApplied,
      discountDetails,
      isUserWantToSaveAddress,
      paymentMethod,
    } = req.body;

    const missingFields = [];

    if (!products.length) missingFields.push("Your Cart is Empty");
    if (!shippingInfo) missingFields.push("shippingInfo");
    if (!contactInfo) missingFields.push("contactInfo");
    if (!totalPrice) missingFields.push("Your Cart is Empty");

    if (missingFields.length > 0) {
      return res.send(error(400, `${missingFields.join(", ")}`));
    }

    const requiredContactFields = ["firstName", "lastName", "email", "phone"];
    const missingContactFields = requiredContactFields.filter(
      (field) => !contactInfo[field]
    );

    if (missingContactFields.length > 0) {
      return res.send(
        error(
          400,
          `Missing required fields in contactInfo: ${missingContactFields.join(", ")}`
        )
      );
    }

    const requiredShippingFields = [
      "address",
      "city",
      "state",
      "country",
      "pinCode",
      "receiverNumber",
    ];
    const missingShippingFields = requiredShippingFields.filter(
      (field) => !shippingInfo[field]
    );

    if (missingShippingFields.length > 0) {
      return res.send(
        error(
          400,
          `Missing required fields in shippingInfo: ${missingShippingFields.join(", ")}`
        )
      );
    }

    const user = req.user;
    if (!user.isProfileCompleted || user?.name == 'Not Updated') {
      user.name = `${contactInfo.firstName} ${contactInfo.lastName}`;
      user.isProfileCompleted = true;
      await user.save();
    }
    const isStockAvailable = await stockSchema.findOne({ stockType: 'Mutual' });

    if (!isStockAvailable) {
      return res.status(200).send(error(404, 'Mutual Stock not Found'));
    }

    if (isStockAvailable.quantity === 0) {
      return res.status(200).send(
        error(400, 'Oops !! Item Out Of Stock, we will contact you once stock is available')
      );
    }

    // Calculate Total Quantity
    const totalQuantity = products.reduce((sum, prod) => sum + prod.quantity, 0);
    console.log('Total Quantity:', totalQuantity);

    // Check COD constraints
    if ((products.length > 1 || totalQuantity > 1) && paymentMethod === 'COD') {
      return res.status(200).send(error(405, 'For COD, at MAX 1 order is allowed'));
    }

    if (paymentMethod === 'COD') {
      const findAlreadyOrderedOrder = await OrderModal.find({
        userId: user._id,
        orderStatus: 'Confirmed',
        paymentMethod: 'COD'
      });


      if (findAlreadyOrderedOrder.length >= 1) {
        return res.send(error(400, 'Only 1 COD order is allowed. Please wait for previous order to be processed.'));
      }
    }

    // Check Stock Availability
    if (totalQuantity > isStockAvailable.quantity) {
      const errorMessage =
        isStockAvailable.quantity > 0
          ? `Oops! Only ${isStockAvailable.quantity} stock left. Please change your cart accordingly.`
          : 'Oops!! Item Out Of Stock, we will contact you once stock is available.';
      return res.status(200).send(error(400, errorMessage));
    }

    // Fetch products and calculate backend total price
    const productIds = products.map((product) => product._id);
    const allProducts = await client.fetch(
      `*[_type == "product" && _id in $productIds]`,
      { productIds }
    );

    let backendTotalPrice = 0;

    for (const product of products) {
      const backendProduct = allProducts.find(
        (item) => item._id === product._id
      );
      if (backendProduct) {
        const selectedPrice =
          backendProduct.sizePricing[product.sizeIndex]?.discountPrice || 0;
        backendTotalPrice += selectedPrice * product.quantity;
      }
    }


    if (isDiscountApplied) {
      const discountInfo = await CouponModal.findById(discountDetails);
      if (!discountInfo) {
        return res.send(error(400, "Coupon Does Not Exist."));
      }

      const isAlreadyAvailedTheCoupon = user.couponUsed.includes(discountDetails);

      if (isAlreadyAvailedTheCoupon) {
        return res.send(error(400, "You've Already Availed this Coupon"));
      }


      const discountAmount = Math.min(
        backendTotalPrice * (discountInfo.discount / 100),
        discountInfo.maxDiscount
      );

      backendTotalPrice -= discountAmount;

      //If the paymentMethod is COD 
      if (paymentMethod == "COD") {
        discountInfo.usersUsed.push(user._id);
        user.couponUsed.push(discountInfo._id);
        await discountInfo.save();
        await user.save();
      }
    }

    if (backendTotalPrice !== totalPrice) {
      return res.send(error(400, "Price Mismatch, Please Check the Total Price"));
    }

    backendTotalPrice *= 100; // Convert to paisa

    let paymentLink = null;
    let merchantTransactionId = null;

    if (paymentMethod !== "COD") {
      merchantTransactionId = generateMerchantTransactionId();
      const merchantUserId = generateMerchantUserId();

      const paymentResponse = await generatePhonepayPaymentLink(
        merchantTransactionId,
        backendTotalPrice,
        contactInfo,
        merchantUserId
      );

      if (!paymentResponse.success) {
        console.log(paymentResponse)
        return res.send(error(500, 'There is some unexpexted issue please contact support'));
      }

      paymentLink = paymentResponse;
    }

    // Create the order
    await OrderTable.create({
      userId: user._id,
      contactInfo,
      shippingInfo,
      orderItems: products,
      paymentInfo: {
        status: paymentMethod === "COD" ? "COD" : "pending",
        amount: backendTotalPrice,
        merchantTransactionId: merchantTransactionId || 'COD ORDER',
      },
      paymentMethod: paymentMethod === "COD" ? "COD" : "Online",
      paymentRequestedAt: new Date().toISOString(),
      totalQuantity: totalQuantity,
      isDiscountApplied: isDiscountApplied ? discountDetails : 'False',
      orderStatus : paymentMethod === "COD" ? 'Confirmed' : 'pending',
      
    });




    isStockAvailable.quantity -= totalQuantity;
    await isStockAvailable.save();

    // Save address if requested
    if (isUserWantToSaveAddress) {
      const newAddressData = {
        firstName: contactInfo.firstName,
        lastName: contactInfo.lastName,
        address: shippingInfo.address,
        city: shippingInfo.city,
        state: shippingInfo.state,
        country: shippingInfo.country,
        pincode: shippingInfo.pinCode,
        apartment: shippingInfo.apartment,
        receiverNumber: shippingInfo.receiverNumber || user.phone,
      };

      const userAddresses = await AddressTable.find({ userId: user._id });
      if (userAddresses.length < 5) {
        const newAddress = await AddressTable.findOneAndUpdate(
          { userId: user._id },
          { $push: { addresses: newAddressData } },
          { new: true, upsert: true }
        );
        // If no previous addresses exist, update the UserModal with the new address
        if (userAddresses.length === 0) {
          await UserModal.findOneAndUpdate(
            { _id: user._id },
            { $set: { address: newAddress._id } },
            { new: true }
          );
        }
      }


      //if it's first address
    }


    

    return res.send(
      success(201, {
        status: paymentMethod === "COD" ? "ORDER PLACED" : "ORDER INITIATED",
        merchantTransactionId,
        amount: backendTotalPrice,
        paymentLink,
      })
    );
  } catch (e) {
    return res.send(error(500, e.message));
  }
};


exports.getLastOrderDetail = async (req, res) => {
  try {
    //find last Order Detail from db for particular user
    const userId = req.user._id;
    if (!userId) {
      return res.status(400).send(error(400, "User ID is required"));
    }
    const lastOrder = await OrderModal.findOne({ userId })
      .sort({ paymentReceivedAt: -1 }) // Sort in descending order to get the most recent
      .lean();

    if (!lastOrder) {
      return res.status(404).send(error(404, "No orders found for this user"));
    }

    res.status(200).send(success(200, lastOrder));
  } catch (e) {
    res.send(error(500, e.message));
  }
}


exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res.status(400).send(error(400, "User ID is required"));
    }
    const allOrders = await OrderModal.find({ userId }).sort({ paymentReceivedAt: -1 }).lean();
    return res.send(success(200, allOrders));
  }
  catch (e) {
    return res.send(error(500, e.message));
  }
}


exports.getAllPendingOrders = async (req, res) => {
  try {
    const allOrderInPendingState = await OrderModal.find({
      "paymentInfo.status": { $in: ["pending", "PAYMENT_PENDING"] }
    });

    return res.send(success(200, allOrderInPendingState));
  } catch (e) {
    return res.send(error(e, e.message));
  }
}


exports.getAllConfirmedOrder = async (req, res) => {
  try {
    const allOrderInConfirmedState = await OrderModal.find({
      orderStatus: 'Confirmed'
    });



    return res.send(success(200, allOrderInConfirmedState));
  } catch (e) {
    return res.send(error(e, e.message));
  }
}

