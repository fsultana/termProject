const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const Schema = mongoose.Schema;

const productSchema = new Schema({
    catagory: String,
    name: String,
    price: Number,
    // for images
    imagepath: String,
    // size: Number
});

module.exports = mongoose.model('Products', productSchema);

// const bookSchema = new Schema({
//     title: String,
//     author: String,
//     price: Number,
//     // for images
//     filename: String,
//     size: Number      
// });

// module.exports = mongoose.model('Books', bookSchema);


