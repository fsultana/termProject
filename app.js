// Fariha Sultana
const express = require('express');
const multer = require('multer');
const ejs = require('ejs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const path = require('path');
const fs = require('fs');


//----------------------------------------------------------------------------------------------------
const uploadImagePrefix = 'image-';
const uploadDir = './public/uploads';
// set storage options of multer
const storageOptions = multer.diskStorage({
    destination: (req, file, callback) => {
        // upload dir path
        callback(null, uploadDir);
    },
    imagepath: (req, file, callback) => {
        callback(null, uploadImagePrefix + Date.now()
            + path.extname(file.originalname));
    }
});

// configure multer
const MAX_FILESIZE = 1024 * 1024 * 3; // 3 MB
const fileTypes = /jpeg|jpg|png|gif/; // accepted file types in regexp

const upload = multer({
    storage: storageOptions,
    limits: {
        fileSize: MAX_FILESIZE
    }, 
    fileFilter: (req, file, callback) => {
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);
        if (mimetype && extname) {
            return callback(null, true);
        } else {
            return callback('Error: Images only');
        }
    }
}).single('imageUpload'); // parameter name at <form> of index.ejs
//----------------------------------------------------------------------------------------

//-------------------------from passport auth files---------------------------------------------------

// flash: to store messages in session
const flash = require('connect-flash');
// morgan: to log every request
const morgan = require('morgan');
// setup express app
const app = express();

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service:'gmail',
    auth:{
        user:'halalgrocery2018@gmail.com',
        pass:'halalgrocery'
    }
});

app.set('view engine', 'ejs');
app.set('views', './ejs_views');
app.use(cookieParser()); //from passport auth files
app.use(morgan('dev')); // log every request to the console, (from passport auth files)
// uploadDir must begin with ./public
app.use('/public', express.static(__dirname + '/public'));

app.use('/style', express.static(__dirname + '/style'));
app.use('/img', express.static(__dirname + '/public/img'));

app.use(express.urlencoded({extended: false}));
//session is used by passport
app.use(session({
    //secret: 'mysecretkey',
    secret: 'my-super-secrete-code!@#$_-++', //from passport auth files
	resave: false,
    saveUninitialized: false,
    maxAge: 60*60*1000  // expire in 1 hour if inactive(from passport auth files)
    // cookie: {
    //     maxAge: 60*60*1000, // unit: ms, if inactive, session expires in 1 hour
    //     path: '/'
    // }
}));

app.use(flash()); // to use flash messages stored in session
app.use(passport.initialize());
app.use(passport.session()); // for persistent login sessions

// protection against cross site request forgery
// const csrf = require('csurf');

// csrf() must be set after cookieParser and session
// app.use(csrf());

// run and connect to the database
require('./models/database');
require('./config/passport');//from passport auth files

const User = require('./models/user');
const Product = require('./models/Product');
const ShoppingCart = require('./models/ShoppingCart');
app.locals.store_title = 'Halal Meat and Grocery';

app.get('/signup', (req, res) => {
    const messages = req.flash('signuperror');
    // res.render('signup', {req, csrfToken: req.csrfToken(), messages});
    res.render('signup', {req, messages});
});

app.post('/signup', passport.authenticate('localsignup', {
    successRedirect: '/verify',
    failureRedirect: '/signup',
    failureFlash: true
}));

app.get('/verify', (req, res) => {
    const messages = req.flash('verifyerror');
    // res.render('verify', {req, csrfToken: req.csrfToken(), messages});
    res.render('verify', {req, messages});
});

// app.post('/verify', passport.authenticate('localverify', {
//     successRedirect: '/login',
//     failureRedirect: '/verify',
//     failureFlash: true
// }));

app.post('/verify', (req, res) => {
    // var cache = [];
    // req = JSON.stringify(req, function(key, value) {
    //     if (typeof value === 'object' && value !== null) {
    //         if (cache.indexOf(value) !== -1) {
    //             // Circular reference found, discard key
    //             return;
    //         }
    //         // Store value in our collection
    //         cache.push(value);
    //     }
    //     return value;
    // });
    // cache = null;
    // console.log(req.body.email + "\n" + req.body.token);
    let email = req.body.email;
    User.findOne({'email': email}, (err, user) => {
        if (err) {
            console.log("post verify error");
        }
        if (!user) {
            console.log("unable to find user");
        }
        else {
            let verified = user.verifyToken(req.body.token, req);
            if(verified){
                console.log("verified!!!");
                
                // Change role of user to registered
                const query = {email: email};
                const value = {
                    $set: {
                        role: 'registered'
                    }           
                };
                User.findOneAndUpdate(query, value, (err, results) => {
                    if (err) {
                        return res.status(500).send('<h1>Verification Error</h1>');
                    }                    
                    const messagesuccess = req.flash('verifysuccess');
                    const messageerror = req.flash('verifyerror');
                    return res.redirect('/storefront');
                });
            }
            else{
                console.log("Not verified :-(");
                const messages = req.flash('verifyerror');
                res.render('verify', {req, messages});
            }
        }
    });
    

});

app.get('/login', (req, res) => {
    const messagesuccess = req.flash('signupsuccess');
    const messageerror = req.flash('loginerror');
    // res.render('login', {req, csrfToken: req.csrfToken(), messagesuccess, messageerror,user: req.user});
    res.render('login', {req, messagesuccess, messageerror, user: req.user});
})

app.get('/shoppingcart', (req, res) => {
    res.render('shoppingcart', {});
})

// register the user at session on successful login
// then, use auth middleware for user protected page access
app.post('/login', passport.authenticate('locallogin', {
    successRedirect: '/storefront',
    failureRedirect: '/login',
    failureFlash: true
}));

app.get('/logout', (req, res) => {
    req.session.shoppingcart = null;

    req.logout();
    res.redirect('/storefront');
});

// isLoggedIn middleware verifies if already logged in
app.get('/', isLoggedIn, (req, res) => {
});

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        if (!req.session.shoppingcart) {
            req.session.shoppingcart = new ShoppingCart().serialize();
        }
    
        Product.find({}, (err, results) => {       
            if (err) {
                return res.render.status(500).send('<h1>Error</h1>');
            }
            return res.render('storefront', {results, Product, user: req.user});
        } ); // where to go next
    } else {
        if (!req.session.shoppingcart) {
            req.session.shoppingcart = new ShoppingCart().serialize();
        }
    
        Product.find({}, (err, results) => {       
            if (err) {
                return res.render.status(500).send('<h1>Error</h1>');
            }
            return res.render('storefront', {results, Product});
        } );
    }
}

//----------------------END of Passport auth app.js----------------------------------------------


// session can hold only serializable data
// functions or instances(objects) cannot be saved in session
// for storefront
app.get('/storefront', (req, res) => { 
    if (!req.session.shoppingcart) {
        req.session.shoppingcart = new ShoppingCart().serialize();
    }

    Product.find({}, (err, results) => {       
		if (err) {
			return res.render.status(500).send('<h1>Error</h1>');
		}
		return res.render('storefront', {results, Product, user: req.user});
    }); // where to go next
 
});

app.get('/add', (req, res) => {
    if (!req.session.shoppingcart) {
        req.session.shoppingcart = new ShoppingCart().serialize();
    }
    const shoppingcart = ShoppingCart.deserialize(req.session.shoppingcart);
    res.render('shoppingcart', {shoppingcart, user: req.user}); // where to go next
});

// "add" button is pressed to add products to ShoppingCart
app.post('/add', (req, res) => {
    Product.findById(req.body._id, (err, product) => { // ------------------------------------------------
        if (err) {
            //console.error("error\n" + JSON.stringify(err, null, 2));
            return res.status(500).send('<h1> Error</h1>');
        }
        if (!req.session.shoppingcart) {
            req.session.shoppingcart = new ShoppingCart().serialize();
        }
        const shoppingcart = ShoppingCart.deserialize(req.session.shoppingcart);

        if(typeof req.body.action !== 'undefined' && req.body.action == 'remove'){
            shoppingcart.remove(product); //-----------------------------------------------------------------------    
        }
        else{
            shoppingcart.add(product); //-----------------------------------------------------------------------
        }

        req.session.shoppingcart = shoppingcart.serialize();
        //console.log('sc', req.session.shoppingcart);
        return res.render('shoppingcart', {shoppingcart, user: req.user});
        //return res.redirect('/');
    });
});

app.get('/checkout', (req, res) => {
    let message = '';
    if (!req.session.shoppingcart || req.session.shoppingcart.length === 0) {
        message = "Did you buy anything yet? Why checkout?";
    } else {
        const shoppingcart = ShoppingCart.deserialize(req.session.shoppingcart);
        message = `Send $${shoppingcart.totalPrice.toFixed(2)}
            to Fariha Sultana immediately!<br>
            Cash only please!<br>
            Your order will be delivered no earlier than March 1, 2030`;
    }
    res.send(`<h1>${message}</h1>`);
});

// for adminPage
app.get('/adminPage', (req, res) => {
    Product.find({}, (err, results) => {
		if (err) {
			return res.render.status(500).send('<h1>Error</h1>');
		}
		return res.render('adminPage', {results, Product, user: req.user});
	}); // where to go next
    
});

// to insert products to database
app.get('/addProducts', (req, res) => {
	res.render('addProducts', {req, user: req.user});
});

app.post('/addProducts', (req, res) => {
   
    // res.render('addProducts', {username: req.body.username})
    upload(req, res, (err) => {
        if (err) {
            return res.render('addProducts', { //refers to addProducts.ejs
                results: null, msg: err, filename: null });
        }
        if (!req.file) {
            return res.render('addProducts', {
                results: null, msg: 'Error: no file selected', filename: null
            });
        }
        const newProduct = new Product({
            //for post method, always use req.body.whatever user input
            category: req.body.category,
            name: req.body.name,
            price: req.body.price,
            imagepath: uploadDir + '/' + req.file.filename,// for image file
           // size: req.file.size  
        });
        newProduct.save((err, results) => {
            if (err) {
                return res.status(500).send('<h1>save() error</h1>', err);
            }
            // Send email notification to registered users
            let query = User.find({role: "registered"});
            query.select('email');
            
            // execute the query
            query.exec(function (err, users) {
                if (err) return handleError(err);
                
                // console.log("emails:\n" + JSON.stringify(users, censor(emails), 2));
                for(let user of users){
                    // console.log(user.email);
                    sendEmail(user.email, "New products from Halal Grocery!",
                        "Hello grocery shopper,\n Halal Grocery is happy to inform you that we have added " +
                        req.body.name + " to our product line! Visit the store and shop today!");
                }
            });
            
            //go to adminPage to add more products or edit/delete
            return res.redirect('/adminPage');
        });
    });
});

// to edit the products
app.get('/updateProducts', (req, res) => {
    // for get method, use req.query.whatever request
    const product = JSON.parse(req.query.productinfo);
    
    // user: req.user is needed so the page will know the user is logged in
	res.render('updateProducts', {product, user: req.user});
});

app.post('/updateProducts', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            return res.render('updateProducts', { //refers to addProducts.ejs
                results: null, msg: err, filename: null });
        }
        
        const query = {_id: req.body._id};
        const value = {
            $set: {
                category: req.body.category,
                name: req.body.name,
                price: req.body.price,
                //imagepath: uploadDir + '/' + req.file.imagepath,
                //filename: uploadDir + '/' + req.file.filename,
                //size: req.file.size 
            }           
        };
        // check if a new file is selected
        if(req.file){
            value.$set.imagepath = uploadDir + '/' + req.file.filename;// req.file.filename has to be filename
            //value.$set.size = req.file.size
            var product = Product.findById(req.body._id, (err, product) => {
                fs.unlink(product.imagepath, (err) => {
                    if (err) {
                        throw err;
                    }
                });
            });
        }
        Product.findOneAndUpdate(query, value, (err, results) => {
            if (err) {
                return res.status(500).send('<h1>Update Error</h1>');
            }
            return res.redirect('/adminPage');
        });
    })
});

// To delete the file from the /public/uploads directory
app.get('/removeProducts', (req, res) => {
    console.log("deleting...");

    let product = Product.findById(req.query._id, (err, product) => {
    //    console.log(JSON.stringify(product));
    //    console.log("_id: " + req.query._id);
        fs.unlink(product.imagepath, (err) => {
            if (err) {
                // what should I do?
                throw err;
            }
        }); 
    }); 

	product.remove( (err, product) => {
		if (err) {
			return res.status(500).send('<h1>Product Delete error</h1>');
        } 
        res.redirect('/adminPage');
	});
});


// Used to JSON.stringify circular structures
function censor(censor) {
    var i = 0;    
    return function(key, value) {
        if(i !== 0 && typeof(censor) === 'object' && typeof(value) == 'object' && censor == value) 
        return '[Circular]'; 
        if(i >= 29) // seems to be a harded maximum of 30 serialized objects?
        return '[Unknown]';
        ++i; // so we know we aren't using the original object anymore
        return value;  
    }
}

// Used to send email notification to registered users
function sendEmail(email, subject, message){
    console.log("Sending email to " + email);

    let mailOptions ={
        from: 'halalgrocery2018@gmail.com',
        to: email,
        subject: subject,
        text: message
    }
    //Now we can use transporter and mailoptions to send email like this
    transporter.sendMail(mailOptions, function(error, info){
        if(error){
            console.log(error);     
        }else {
            console.log('Email sent: ' + info.response);
        }
    });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log('Server started at port', port);
});