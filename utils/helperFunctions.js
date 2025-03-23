const crypto = require("crypto");
const axios = require("axios");
const OrderModal = require("../models/OrderModal");
const stockSchema = require("../models/stockSchema");
const CouponModal = require("../models/CouponModal");
const UserModal = require("../models/UserModal");
const nodemailer = require("nodemailer");
const FailedEmail = require("../models/FailedEmail");

const { MAX_ATTEMPTS } = require("../constants/variables");

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
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      // secure: true,
      service: "hostinger",
      auth: {
        user: process.env.HOSTINGER_SUPPORT_EMAIL, // Replace with your Hostinger email
        pass: process.env.HOSTINGER_SUPPORT_PASS, // Replace with your Hostinger email password
      },
    });

    await transporter.sendMail({
      from: process.env.HOSTINGER_SUPPORT_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

  } catch (e) {
    throw new Error(`Failed to send email: ${e.message}`);
  }
};



const processFailedEmails = async () => {

  try {
    console.log("🔄 Checking for failed emails...");
    const failedEmails = await FailedEmail.find({ attempts: { $lt: MAX_ATTEMPTS } });


    for (const email of failedEmails) {
      console.log(`🚀 Retrying email to ${email.to} (Attempt ${email.attempts + 1})`);
      const emailHTML = generateEmailTemplate(email.data, email.website, email.subject);

      try {
        await sendEmail({
          to: email.to,
          subject: email.subject,
          html: emailHTML
        });


        await FailedEmail.deleteOne({ _id: email._id });

        console.log("✅ Email sent successfully to ", email.to);

      } catch (e) {

        await FailedEmail.updateOne({ _id: email._id }, { $inc: { attempts: 1 } });

        if (email.attempts + 1 >= MAX_ATTEMPTS) {
          console.log(`🚨 Max retry attempts reached for ${email.to}, stopping retries.`);

        }
      }
    }

  } catch (e) {
    console.log("Error while processing failed emails ", e.message);
  }

}



const generateEmailTemplate = (formData, website, subject) => {

  let fielsdHTML = ``;

  for (let field in formData) {
    fielsdHTML += `<p><strong>${field}:</strong> ${formData[field]}</p>\n`;
  }

  return `
  <!DOCTYPE html>
  <html>
  <head>
      <style>
          body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
          }
          .container {
              max-width: 600px;
              margin: 20px auto;
              background: #ffffff;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          .header {
              background: #2d378e;
              color: #ffffff;
              text-align: center;
              padding: 15px;
              font-size: 22px;
              border-radius: 8px 8px 0 0;
          }
          .content {
              padding: 20px;
              color: #333333;
          }
          .content p {
              font-size: 16px;
              line-height: 1.6;
          }
          .content strong {
              color: #2d378e;
          }
          .footer {
              text-align: center;
              font-size: 14px;
              color: #777777;
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px solid #dddddd;
          }
          .footer a {
              color: #2d378e;
              text-decoration: none;
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">New Contact Form Submission</div>
          <div class="content">
              <p><strong>Website:</strong> ${website}</p>
              <p><strong>Subject:</strong> ${subject}</p>
              ${fielsdHTML}
          </div>
          <div class="footer">
              <p>This message was sent from the contact form on <a href="https://${website}" target="_blank">${website}</a></p>
          </div>
      </div>
  </body>
  </html>
  `;


}

module.exports = { generateMerchantTransactionId, generatePhonepayPaymentLink, generateMerchantUserId, processPaymentStatusFromPPay, processFailedEmails, sendEmail, generateEmailTemplate };
