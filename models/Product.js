const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const Schema = mongoose.Schema;

const productSchema = new Schema({
    category: String,
    name: String,
    price: Number,
    // for images
    imagepath: String,
    //size: Number,
});

module.exports = mongoose.model('Product', productSchema);

