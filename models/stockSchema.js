const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
    stockType : {type : String, default : 'Mutual'},
    quantity: { type: Number, required: true }, // Current stock
});

module.exports = mongoose.model('StockTable', stockSchema);
