const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
mongoose.Promise = global.Promise;

const userSchema = mongoose.Schema({
    email: {
        type: String, required: true, trim: true, unique: true
    },
    password: {
        type: String, required: true, minlength: 3
    },
    role: {
        type: String, enum: ['unregistered', 'registered', 'admin'], default: 'unregistered'
    },
    email_token: {
        type: String, required: false
    }
});

userSchema.methods.encryptPassword = function(password, callback) {
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return callback(err);
        else return callback(null, hash);
    });
}

userSchema.methods.verifyPassword = function(password, callback) {
    bcrypt.compare(password, this.password, (err, result) => {
        if (err) return callback(err);
        return callback(null, result);
    });
}

// userSchema.methods.verifyToken = function(token, callback){
//     return callback(null, (token === this.token));
// }

userSchema.methods.verifyToken = function(token, req){
    let verified =  (token === this.email_token);
    if(verified){
        req.flash('verifysuccess', 'Token verified');
    }
    else{
        req.flash('verifyerror', 'Invalid token');
    }
    return verified;
}

userSchema.methods.setRole = function(role){
    this.role = role;
}

module.exports = mongoose.model('users', userSchema);