const { client } = require("../config/config");
const OrderModal = require("../models/OrderModal");
const UserModal = require("../models/UserModal");
const { error, success } = require("../utils/responseWrapper")


const moment = require("moment");

exports.getDashboardData = async (req, res) => {
    try {
        // Define the current week's date range
        const startOfWeek = moment().startOf("week").toDate();
        const endOfWeek = moment().endOf("week").toDate();

        // Aggregate data from orders
        const dashboardData = await OrderModal.aggregate([
            {
                $facet: {
                    // Fetch pending transactions
                    pendingTransactions: [
                        { $match: { "paymentInfo.status": { $in: ["pending", "PAYMENT_PENDING"] } } },
                        { $count: "count" },
                    ],

                    // Pending orders based on orderStatus being "Confirmed"
                    pendingOrders: [
                        { $match: { orderStatus: "Confirmed" } },
                        { $count: "count" },
                    ],

                    // Completed orders based on orderStatus being "Delivered"
                    completedOrders: [
                        { $match: { orderStatus: "Delivered" } },
                        { $count: "count" },
                    ],

                    // COD and online transactions for the current week
                    transactionsByMethod: [

                        {
                            $group: {
                                _id: "$paymentMethod",
                                count: { $sum: 1 },
                            },
                        },
                    ],

                    // Day-wise product sales for the current week
                    dayWiseSales: [
                        {
                            $match: {
                                paymentRequestedAt: { $gte: startOfWeek, $lte: endOfWeek },
                                orderStatus: { $in: ["Delivered", "Confirmed"] },
                            },
                        },
                        {
                            $group: {
                                _id: { $dayOfWeek: "$paymentRequestedAt" }, // Day of the week
                                totalSales: { $sum: "$paymentInfo.amount" },
                                productCount: { $sum: "$totalQuantity" },
                            },
                        },
                    ],
                },
            },
        ]);

        // Fetch total users and products separately
        const [totalUsers, totalProducts] = await Promise.all([
            UserModal.countDocuments(), // Total users
            client.fetch(`*[_type == "product"] { _id }`)
        ]);

        const dayWiseSales = dashboardData[0]?.dayWiseSales || [];
        const salesData = Array(7).fill(0);

        dayWiseSales.map((entry) => {
            salesData[entry._id - 1] = entry.totalSales / 100; // Subtract 1 to match array index (0-6) and divide by 100 for rs

        })


        // Extract and format results
        const pendingTransactions = dashboardData[0]?.pendingTransactions[0]?.count || 0;
        const pendingOrders = dashboardData[0]?.pendingOrders[0]?.count || 0;
        const completedOrders = dashboardData[0]?.completedOrders[0]?.count || 0;

        // Organize COD and online transactions
        let codTransactions = 0;
        let onlineTransactions = 0;
        dashboardData[0]?.transactionsByMethod.forEach((transaction) => {
            if (transaction._id === "COD") codTransactions = transaction.count;
            if (transaction._id === "Online") onlineTransactions = transaction.count;
        });

        // Response payload
        return res.status(200).send(success(200, {
            pendingTransactions,
            pendingOrders,
            completedOrders,
            totalUsers,
            totalProducts: totalProducts.length,
            codTransactions,
            onlineTransactions,
            dayWiseCurrentWeekSales: salesData,
        },));
    } catch (e) {
        return res.status(500).error(500, e.message);
    }
};


exports.getAllOrders = async (req, res) => {
    try {
        const allOrders = await OrderModal.find()
        .select("userId _id orderStatus paymentRequestedAt")
        .sort({ paymentRequestedAt: -1 });

        return res.send(success(200, allOrders));
    } catch (e) {
        return res.send(error(500, e.message));
    }
}


exports.getOrderDetail = async (req, res) => {
    try {
        const {id} = req.params;

        if(!id){
            return res.send(error(404,"ID Not provided"));
        }


        const orderDetails = await OrderModal.findById(id).select("paymentInfo","orderStatus", "userId");


        if(!orderDetails){
            return res.send(error(404,"Order Not Found"));
        }

        return res.send(success(200, orderDetails));
    } catch (e) {
        return res.send(error(500, e.message));
    }
}