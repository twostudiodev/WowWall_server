const express = require("express");
const app = express();
const morgan = require('morgan');
const cors = require("cors");
const cookie = require('cookie-parser')

const dotenv = require('dotenv');
dotenv.config({ path: './config/config.env' });

const ORIGINS = process.env.ORIGINS ? process.env.ORIGINS.split(',') : []
console.log("All Origins", ORIGINS)

//Allow FE 
app.use(cors({
    origin: ORIGINS,
    credentials: true,
}))

app.set('trust proxy', 1); // Trust the first proxy (Vercel)



//Function to connect database
const dbConnect = require('./config/database');
dbConnect();


//Middlewares
app.use(express.json());
app.use(morgan('common'));
app.use(cookie())



//Global api endpoint
app.get('/health', (req, res) => {
    res.json('WowWall Api up and running');
})

//Routes
const userRoutes = require('./routers/userRoutes');
const productRoutes = require('./routers/productRoute');
const orderRoutes = require('./routers/orderRoute');
const paymentRoutes = require('./routers/paymentRoute');
const couponRoutes = require('./routers/couponRoute');
const adminRoutes = require('./routers/adminRoute');
const { processPaymentStatusFromPPay } = require("./utils/helperFunctions");
app.use('/api/v1', userRoutes);
app.use("/api/v1", productRoutes);
app.use("/api/v1", paymentRoutes);
app.use("/api/v1", orderRoutes);
app.use("/api/v1", couponRoutes);
app.use("/api/v1", adminRoutes);


//Listening on PORT 
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})


setInterval(() => {
    processPaymentStatusFromPPay();
}, 20 * 60000)