const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    review: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    imgData: {
        type: {
            publicID: { type: String, default: '' },
            publicUrl: { type: String, default: '' }
        },
        default: {}
    }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
    reviews: [reviewSchema],
    productId: { type: String, required: true }
});

module.exports = mongoose.model('reviewTable', productSchema);
