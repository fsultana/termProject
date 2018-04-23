// passport is also imported at app.js
// the configuration made at app.js is available here too
// do not configure it again
const passport = require('passport');
const User = require('../models/user');
const LocalStrategy = require('passport-local').Strategy;

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service:'gmail',
    auth:{
        user:'halalgrocery2018@gmail.com',
        pass:'halalgrocery'
    }
});

// how to serialize user to store in session
passport.serializeUser((user, callback) => {
    callback(null, user._id);
});

// how to deserailize user from serialized data (user)
passport.deserializeUser((id, callback) => {
    User.findById(id, (err, user) => {
        callback(err, user);
    })
});

const localStrategyConfig = {
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true // pass the eniter request to the callback
}

passport.use('localsignup',
    new LocalStrategy(localStrategyConfig, (req, email, password, callback) => {
        User.findOne({'email': email}, (err, user) => {
            if (err) return callback(null, false, req.flash('signuperror', err));
            if (user) return callback(null, false, req.flash('signuperror','Email is already in use'));

            const newUser = new User();
            newUser.email = email;
            
            // Generate email verification token
            let token = Math.random().toString(36).substr(2, 5);
            newUser.email_token = token;

            let mailOptions ={
                from:'halalgrocery2018@gmail.com',
                to: email,
                subject:'Halal Grocery verification code',
                text: 'Please verify your email address using this token: ' + token
            }
            //Now we can use transporter and mailoptions to send email like this
            transporter.sendMail(mailOptions, function(error, info){
                if(error){
                    console.log(error);     
                }else {
                    console.log('Email sent: ' + info.response);
                }
            });

            newUser.encryptPassword(password, (err, result) => {
                if (err) return callback(null, false, req.flash('signuperror', err));
                newUser.password = result;
                newUser.save((err, result) => {
                    if (err) return callback(err);
                    return callback(null, newUser, req.flash('signupsuccess', 'Sign up successful! Login, please!'));
                });
            });
        });
    })
);

passport.use('locallogin',
    new LocalStrategy(localStrategyConfig, (req, email, password, callback) => {
        User.findOne({'email': email}, (err, user) => {
            if (err) return callback(null, false, req.flash('loginerror', err));
            if (!user) return callback(null, false, req.flash('loginerror', 'Invalid email'));
            user.verifyPassword(password, (err, result) => {
                if (err) return callback(null, false, req.flash('loginerror', err)); 
                if (!result) return callback(null, false, req.flash('loginerror', 'Incorrect password'));
                return callback(null, user);
            });
        });
    })
);
