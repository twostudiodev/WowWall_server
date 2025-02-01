const axios = require("axios");
const { error, success } = require("../utils/responseWrapper");
const uniqid = require("uniqid");
const sha256 = require("sha256");
const crypto = require("crypto");
const { generateMerchantTransactionId, generateMerchantUserId } = require("../utils/helperFunctions");
const OrderModal = require("../models/OrderModal");
const UserModal = require("../models/UserModal");
const stockSchema = require("../models/stockSchema");
const CouponModal = require("../models/CouponModal");

exports.paymentController = async (req, res) => {

  const PHONEPAY_BASE_URL = process.env.PHONEPAY_BASE_URL;
  const PHONEPAY_ENDPOINT = process.env.PHONEPAY_ENDPOINT;
  const PHONEPAY_MERCHANT_ID = process.env.PHONEPAY_MERCHANTID;
  const PHONEPAY_SALTKEY = process.env.PHONEPAY_SALTKEY;
  const PHONEPAY_SALTIND = process.env.PHONEPAY_SALTIND;
  const PHONEPAY_REDIRECT_URL = process.env.PHONEPAY_REDIRECT_URL;

  const merchantTransactionId = generateMerchantTransactionId();
  const merchantUserId = generateMerchantUserId();



  try {
    const data = {
      merchantId: PHONEPAY_MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: merchantUserId,
      name: "Hammad",
      amount: 100,
      redirectUrl: `https://wowwall.in/payment/${merchantTransactionId}`,
      redirectMode: "POST",
      mobileNumber: "9315591062",
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };


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
    return res.send(success(200, response.data));
  } catch (e) {
    console.log(e);
    return res.send(500, e.message);
  }
}

exports.verifyPhonePayCallback = async (req, res) => {
  try {
    // const unqiueMerchantId = req.params.id;
    const { merchantTransactionId } = req.params;
    const merchantId = process.env.PHONEPAY_MERCHANTID
    if (!merchantTransactionId || !merchantId) {
      return res.send(error(500, "merchantTransactionId or merchantId missing"))
    }

    const keyIndex = 1;
    const string = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + process.env.PHONEPAY_SALTKEY;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    const checksum = sha256 + '###' + keyIndex;

    const option = {
      method: 'GET',
      url: `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${merchantTransactionId}`,
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': `${merchantId}`
      }


    }
    const paymentStatus = await axios.request(option);
    console.log("Payment Status ", paymentStatus);
    const orderDetail = await OrderModal.findOne({
      "paymentInfo.merchantTransactionId": merchantTransactionId,
    });

    const stockAvailable = await stockSchema.findOne({ stockType: 'Mutual' });

    if (paymentStatus.data.code == 'PAYMENT_SUCCESS') {
      // Order is successful, find order from db using merchantTransactionId
      if (orderDetail) {
        console.log("Order found:", orderDetail);
        if (orderDetail.isDiscountApplied != 'False') {
          const couponAppliedDetail = await CouponModal.findById(orderDetail.isDiscountApplied);
          couponAppliedDetail.usersUsed.push(orderDetail.userId);
          const userUsedCoupon = await UserModal.findById(orderDetail.userId);
          userUsedCoupon.couponUsed.push(couponAppliedDetail);

          await userUsedCoupon.save();
          await couponAppliedDetail.save();

        }
        orderDetail.paymentInfo.status = 'PAYMENT_SUCCESS'
        orderDetail.paymentInfo.transactionId = paymentStatus.data.data.transactionId;
      } else {
        console.log("No order found for the given merchantTransactionId");
      }
    }
    else if (paymentStatus.data.code == 'PAYMENT_ERROR') {
      if (orderDetail) {
        orderDetail.paymentInfo.status = 'PAYMENT_FAILED'
        orderDetail.orderStatus = 'Failed'
        if (orderDetail?.totalQuantity)
          stockAvailable.quantity += orderDetail.totalQuantity

        if (paymentStatus.data.data?.transactionId) {
          orderDetail.paymentInfo.transactionId = paymentStatus.data.data.transactionId;
        }

      }
    }
    else if (paymentStatus.data.code = 'PAYMENT_PENDING') {
      if (orderDetail) {
        orderDetail.paymentInfo.status = 'PAYMENT_PENDING';
        orderDetail.orderStatus = 'Pending'

        if (paymentStatus.data.data?.transactionId) {
          orderDetail.paymentInfo.transactionId = paymentStatus.data.data.transactionId;
        }
      }
    }
    else {
      if (orderDetail) {
        if (orderDetail?.totalQuantity)
          stockAvailable.quantity += orderDetail.totalQuantity
        orderDetail.orderStatus = 'NA'
        orderDetail.paymentInfo.status = paymentStatus.data.code;
      }
    }

    const now = new Date();
    if (orderDetail) {
      orderDetail.paymentReceivedAt = now.toISOString();
    }

    await orderDetail.save();
    await stockAvailable.save();

    // console.log(req.params.id,unqiueMerchantId);
    res.redirect(process.env.REDIRECT_ORIGIN_SUCCESS);

    // res.send(success(200, paymentStatus));
  } catch (e) {
    return res.redirect(process.env.REDIRECT_ORIGIN_SUCCESS);
    // return res.send(error(500, e.message));
  }
};






exports.verifyServerToServerCallBack = (req, res) => {
  try {
    const { merchantId, merchantTransactionId } = req.body;
    console.log(req);


    return res.status(200).send(success(200, { merchantId, merchantTransactionId }));
  } catch (e) {
    return res.send(error(500, e.message));
  }
}