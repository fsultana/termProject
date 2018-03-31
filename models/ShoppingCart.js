const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const Schema = mongoose.Schema;


// const Product = require('Product');

class ShoppingCart {
    constructor() {
        this.cart = []; //this.cart = [{product, qty}]
    }
    serialize() {
        let serial = [];
        for (const item of this.cart) {
            serial.push({product: item.product, qty: item.qty});
        }
        return serial;
    }
    static deserialize(serial) {
        let sc = new ShoppingCart();
        for (const item of serial) {
            sc.deserial_additem(item);
        }
        return sc;
    }
    deserial_additem(item) { // {product, qty}
        this.cart.push(
            {product: item.product, qty: item.qty}
        );
    }
    add(product) {
        for (const item of this.cart) {
            if (item.product._id == product._id) {
                item.qty++;
                return;
            }
        }
        //console.log("product:\n" + JSON.stringify(product, null, 2));
        this.cart.push({product: product, qty: 1}); //why is it null????`
        
    }
    get totalPrice() {
        let total = 0;
        for (const item of this.cart) {
            total += item.product.price * item.qty;
        }
        return total;
    }
}

module.exports = ShoppingCart;