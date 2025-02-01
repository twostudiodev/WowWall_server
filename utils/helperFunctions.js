const crypto = require("crypto");
const axios = require("axios");
const OrderModal = require("../models/OrderModal");
const stockSchema = require("../models/stockSchema");
const CouponModal = require("../models/CouponModal");
const UserModal = require("../models/UserModal");
const nodemailer = require("nodemailer");

const generateMerchantTransactionId = () => {
  const prefix = "TXN"; // Transaction prefix for identification (3 characters)
  const timestamp = Date.now().toString(36); // Encodes the current timestamp
  const randomPart = Math.random().toString(36).substring(2, 12); // Random alphanumeric string (10 characters)

  const transactionId = `${prefix}_${timestamp}_${randomPart}`;

  // Ensure the ID length is under 35 characters
  return transactionId.substring(0, 35);
};


const generateMerchantUserId = () => {
  const prefix = "UID"; // User ID prefix for identification (3 characters)
  const timestamp = Date.now().toString(36); // Encodes the current timestamp
  const randomPart = Math.random().toString(36).substring(2, 12); // Random alphanumeric string (10 characters)

  const userId = `${prefix}_${timestamp}_${randomPart}`;

  // Ensure the ID length is under 35 characters
  return userId.substring(0, 35);
}


const generatePhonepayPaymentLink = async (
  merchantTransactionId,
  amount,
  userInfo,
  merchantUserId
) => {
  const PHONEPAY_BASE_URL = process.env.PHONEPAY_BASE_URL;
  const PHONEPAY_ENDPOINT = process.env.PHONEPAY_ENDPOINT;
  const PHONEPAY_MERCHANT_ID = process.env.PHONEPAY_MERCHANTID;
  const PHONEPAY_SALTKEY = process.env.PHONEPAY_SALTKEY;
  const PHONEPAY_SALTIND = process.env.PHONEPAY_SALTIND;
  const PHONEPAY_REDIRECT_URL = process.env.PHONEPAY_REDIRECT_URL;


  try {
    const data = {
      merchantId: PHONEPAY_MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: merchantUserId,
      name: userInfo.firstName,
      amount: amount,
      callbackUrl: 'https://api.wowwall.in/api/v1/payment/server',
      redirectUrl: `${PHONEPAY_REDIRECT_URL}${merchantTransactionId}`,
      redirectMode: "POST",
      // mobileNumber: userInfo.phone,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    console.log("Pay data", data);

    const base64Payload = Buffer.from(JSON.stringify(data)).toString("base64");
    const payload = JSON.stringify(data);
    const payloadMain = Buffer.from(payload).toString("base64");
    const string = base64Payload + "/pg/v1/pay" + PHONEPAY_SALTKEY;
    const sha256 = crypto.createHash("sha256").update(string).digest("hex");
    const checksum = sha256 + "###" + PHONEPAY_SALTIND;

    const options = {
      method: "POST",
      url: `${PHONEPAY_BASE_URL}${PHONEPAY_ENDPOINT}`,
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
        "Referrer-Policy": "strict-origin-when-cross-origin" // Correct header name
      },
      data: {
        request: base64Payload,
      },
    };

    const response = await axios.request(options);

    return response.data;

  } catch (e) {
    return e.message;
  }
};



const processPaymentStatusFromPPay = async () => {
  try {
    //Fethch All Orders From Db Which have payment status as pending
    //Verify with Ppay to get the new status of order
    const PHONEPAY_MERCHANT_ID = process.env.PHONEPAY_MERCHANTID;
    const PHONEPAY_SALTKEY = process.env.PHONEPAY_SALTKEY;
    const BASE_PHONEPE_URL = "https://api.phonepe.com/apis/hermes/pg/v1/status";

    const allOrderInPendingState = await OrderModal.find({
      "paymentInfo.status": { $in: ["pending", "PAYMENT_PENDING"] }
    });

    const stockAvailable = await stockSchema.findOne({ stockType: 'Mutual' });

    if (allOrderInPendingState.length) {
      const keyIndex = 1;

      for (const order of allOrderInPendingState) {
        try {
          // Construct checksum
          const string = `/pg/v1/status/${PHONEPAY_MERCHANT_ID}/${order?.paymentInfo?.merchantTransactionId}` + PHONEPAY_SALTKEY;
          const sha256 = crypto.createHash('sha256').update(string).digest('hex');
          const checksum = `${sha256}###${keyIndex}`;

          // API call options
          const options = {
            method: 'GET',
            url: `${BASE_PHONEPE_URL}/${PHONEPAY_MERCHANT_ID}/${order?.paymentInfo?.merchantTransactionId}`,
            headers: {
              accept: 'application/json',
              'Content-Type': 'application/json',
              'X-VERIFY': checksum,
              'X-MERCHANT-ID': PHONEPAY_MERCHANT_ID
            }
          };

          // Make API call
          const { data: paymentStatus } = await axios.request(options);

          // Update order and stock based on payment status
          if (paymentStatus.code === 'PAYMENT_SUCCESS') {
            try {
              if (order.isDiscountApplied !== 'False') {
                const couponAppliedDetail = await CouponModal.findById(order.isDiscountApplied);
                const userUsedCoupon = await UserModal.findById(order.userId);

                if (couponAppliedDetail && userUsedCoupon) {
                  couponAppliedDetail.usersUsed.push(order.userId);
                  userUsedCoupon.couponUsed.push(couponAppliedDetail._id); 

                  await Promise.all([userUsedCoupon.save(), couponAppliedDetail.save()]);
                } else {
                  console.warn(`Coupon or User not found for order: ${order._id}`);
                }
              }

              // Update order details
              order.paymentInfo.status = 'PAYMENT_SUCCESS';
              order.paymentInfo.transactionId = paymentStatus.data?.transactionId || null;
              order.orderStatus = 'Confirmed';
              await order.save();
            } catch (error) {
              console.error(`Error processing PAYMENT_SUCCESS for order ${order._id}:`, error.message);
            }
          } else if (paymentStatus.code === 'PAYMENT_ERROR') {
            order.paymentInfo.status = 'PAYMENT_FAILED';
            order.orderStatus = 'Failed';
            if (order?.totalQuantity) stockAvailable.quantity += order.totalQuantity;
            if (paymentStatus.data?.transactionId) order.paymentInfo.transactionId = paymentStatus.data.transactionId;
          } else if (paymentStatus.code === 'PAYMENT_PENDING') {
            order.paymentInfo.status = 'PAYMENT_PENDING';
            order.orderStatus = 'Pending';
            if (paymentStatus.data?.transactionId) order.paymentInfo.transactionId = paymentStatus.data.transactionId;
          } else {
            order.paymentInfo.status = paymentStatus.code;
            order.orderStatus = 'NA';
            if (order?.totalQuantity) stockAvailable.quantity += order.totalQuantity;
          }

          // Save order and stock
          await order.save();
        } catch (error) {
          console.error(`Error processing order ${order._id}:`, error.message);
        }
      }

      // Save stock after all updates
      await stockAvailable.save();
      console.log("This is stockAvailable", stockAvailable);
    }
  } catch (e) {
    console.log(e.message);
  }
}

const sendEmail = async (options) => {
  try {
    console.log(process.env.HOSTINGER_EMAIL,process.env.HOSTINGER_PASS)
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      // secure: true,
      service: "hostinger",
      auth: {
        user: process.env.HOSTINGER_EMAIL, // Replace with your Hostinger email
        pass: process.env.HOSTINGER_PASS, // Replace with your Hostinger email password
      },
    });

    await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  } catch (e) {
    throw new Error(`Failed to send email: ${e.message}`);
  }
};


module.exports = { generateMerchantTransactionId, generatePhonepayPaymentLink, generateMerchantUserId, processPaymentStatusFromPPay,sendEmail };
