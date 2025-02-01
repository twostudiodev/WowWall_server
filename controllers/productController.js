const { client } = require("../config/config");
const ReviewModal = require("../models/ReviewModal");
const stockSchema = require("../models/stockSchema");
const { error, success } = require("../utils/responseWrapper");

const cloudinary = require("cloudinary").v2;

exports.createNewReview = async (req, res) => {
  const { name, email, title, review, rating, imgData, productId } = req.body;  // Get review data from the body

  try {
    let imageUrl = { publicID: "", publicUrl: "" };
    if (imgData) {
      // Upload image to Cloudinary
      const uploadResponse = await cloudinary.uploader.upload(imgData, {
        folder: 'reviews',
      });
      imageUrl.publicUrl = uploadResponse.secure_url;
      imageUrl.publicID = uploadResponse.public_id;

    }

    const updatedProduct = await ReviewModal.findOneAndUpdate(
      { productId }, // Find by productId
      {
        $push: {
          reviews: {
            name,
            email,
            title,
            review,
            rating,
            imgData: imageUrl // Use the Cloudinary image URL if an image was uploaded
          }
        }
      },
      { new: true, upsert: true } // `new: true` returns the updated document, `upsert: true` creates a new product if not found
    );

    return res.send(success(200, "Review created successfully"));
  } catch (e) {
    console.error(e);
    return res.send(error(500, 'Unexpected Error Occured'));
  }
};


exports.getProductReviews = async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await ReviewModal.findOne({ productId });

    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    let totalRating = 0;
    let starCount = {
      "5star": 0,
      "4star": 0,
      "3star": 0,
      "2star": 0,
      "1star": 0,
    };

    product.reviews.forEach(review => {
      totalRating += review.rating;

      switch (review.rating) {
        case 5:
          starCount["5star"]++;
          break;
        case 4:
          starCount["4star"]++;
          break;
        case 3:
          starCount["3star"]++;
          break;
        case 2:
          starCount["2star"]++;
          break;
        case 1:
          starCount["1star"]++;
          break;
        default:
          break;
      }
    });

    const cumulativeRating = product.reviews.length
      ? (totalRating / product.reviews.length).toFixed(1)
      : "0";

    // Prepare the response data
    const response = {
      reviews: product.reviews,
      cumulativeRating: cumulativeRating,
      starCount: starCount
    };

    return res.status(200).send(success(200, response));

  } catch (e) {
    console.error(e);
    return res.status(500).send(error(500, 'Unexpected Error Occured'));
  }
};


exports.getCurrentStock = async (req, res) => {
  try {
    const availableStock = await stockSchema.findOne({ stockType: 'Mutual' });

    return res.send(success(200, availableStock));
  } catch (e) {
    return res.status(500).send(error(500, 'Unexpected Error Occures'));
  }
}

exports.updateCurrentStock = async (req, res) => {
  try {
    const { newStockCount } = req.body;
    const availableStock = await stockSchema.findOne({ stockType: 'Mutual' });

    if (!availableStock) {
      return res.send(error(404, 'Mutual Stock not Found'));
    }

    availableStock.quantity = newStockCount;

    await availableStock.save();

    return res.send(success(200, availableStock));
  } catch (e) {
    return res.status(500).send(error(500, 'Unexpected Error Occured'));
  }
}

exports.createCurrentStock = async (req, res) => {
  try {
    const { stockCount } = req.body;
    const availableStock = await stockSchema.findOne({ stockType: 'Mutual' });

    if (availableStock) {
      return res.send(error(404, 'Stock Already exist'));
    }

    const newStock = await stockSchema.create({
      quantity: stockCount
    })


    return res.send(success(200, newStock));
  } catch (e) {
    return res.status(500).send(error(500, 'Unexpected Error Occured'));
  }
}