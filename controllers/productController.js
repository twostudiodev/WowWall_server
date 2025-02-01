const { client } = require("../config/config");
const stockSchema = require("../models/stockSchema");
const { error, success } = require("../utils/responseWrapper");

exports.createNewReview = async (req, res) => {
  try {
    const { productId, name, email, image, title, description, rating } =
      req.body;

    // Validation
    if (!productId || !name || !title || !description || !rating) {
      return res.status(400).send(error(400, "Missing required fields"));
    }

    // Create a new review in Sanity
    const newReview = await client.create({
      _type: "review",
      product: { _type: "reference", _ref: productId },
      name,
      email,
      image,
      title,
      description,
      rating,
      publishedAt: new Date().toISOString(),
    });

    return res.send(
      success(201, { message: "Review created successfully", newReview })
    );
  } catch (e) {
    return res.send(error(500, e.message));
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