const express = require("express");
const app = express();
const morgan = require('morgan');
const cors = require("cors");
const cookie = require('cookie-parser')
const cloudinary = require("cloudinary").v2;

const dotenv = require('dotenv');
dotenv.config({ path: './config/config.env' });



//Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

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
const websiteRoutes = require('./routers/websiteRoute');
const { processPaymentStatusFromPPay, processFailedEmails } = require("./utils/helperFunctions");
const { FAILED_EMAIL_INTERVAL } = require("./constants/variables");
app.use('/api/v1', userRoutes);
app.use("/api/v1", productRoutes);
app.use("/api/v1", paymentRoutes);
app.use("/api/v1", orderRoutes);
app.use("/api/v1", couponRoutes);
app.use("/api/v1", adminRoutes);
app.use("/api/v1", websiteRoutes);


//Listening on PORT 
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})


setInterval(() => {
    processPaymentStatusFromPPay();
}, 20 * 60000);


setInterval(() => {
    processFailedEmails();
}, FAILED_EMAIL_INTERVAL);