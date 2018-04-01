// minimalistic online store: no real database, no authentication
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
    filename: (req, file, callback) => {
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
const csrf = require('csurf');
// csrf() must be set after cookieParser and session
app.use(csrf());

// run and connect to the database
require('./models/database');
require('./config/passport');//from passport auth files
const Product = require('./models/Product');
const ShoppingCart = require('./models/ShoppingCart');
app.locals.store_title = 'Halal Meat and Grocery';

//for the index page links
// app.get('/', (req, res) => {
    
//     res.render('index', {}); // where to go next
// });

app.get('/signup', (req, res) => {
    const messages = req.flash('signuperror');
    res.render('signup', {req, csrfToken: req.csrfToken(), messages});
});

app.post('/signup', passport.authenticate('localsignup', {
    successRedirect: '/login',
    failureRedirect: '/signup',
    failureFlash: true
}));

app.get('/login', (req, res) => {
    const messagesuccess = req.flash('signupsuccess');
    const messageerror = req.flash('loginerror');
    res.render('login', {req, csrfToken: req.csrfToken(), messagesuccess, messageerror,user: req.user});
})

app.get('/shoppingcart', (req, res) => {
    res.render('shoppingcart', {});
})

// register the user at session on successful login
// then, use auth middleware for user protected page access
app.post('/login', passport.authenticate('locallogin', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});

// isLoggedIn middleware verifies if already logged in
app.get('/', isLoggedIn, (req, res) => {
    // get user stored in session object and pass it
    res.render('index', {user: req.user});
})

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.render('index', {});
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
		return res.render('storefront', {results, Product});
    }); // where to go next
 
});

// "add" button is pressed to add books to ShoppingCart
app.post('/add', (req, res) => {
    Product.findById(req.body._id, (err, book) => {
        if (err) {
            console.error("error\n" + JSON.stringify(err, null, 2));
			return res.status(500).send('<h1> Error</h1>');
        }
        if (!req.session.shoppingcart) {
            req.session.shoppingcart = new ShoppingCart().serialize();
        }
        const shoppingcart = ShoppingCart.deserialize(req.session.shoppingcart);
        shoppingcart.add(book);
        req.session.shoppingcart = shoppingcart.serialize();
        //console.log('sc', req.session.shoppingcart);
        return res.render('shoppingcart', {shoppingcart});
		//return res.redirect('/');
    })	
});

app.get('/checkout', (req, res) => {
    let message = '';
    if (!req.session.shoppingcart) {
        message = "Did't you buy anything yet? Why checkout?";
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
		return res.render('adminPage', {results, Product});
	}); // where to go next
     
});

// to insert products to database
app.get('/addProducts', (req, res) => {
	res.render('addProducts');
});

app.post('/addProducts', (req, res) => {
    
    upload(req, res, (err) => {
        if (err) {
            return res.render('addProducts', { //refers to addBooks.ejs
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
            //go to adminPage to add more books or edit/delete
            return res.redirect('/adminPage'); 
        });
    });
});

// to edit the books
app.get('/updateBooks', (req, res) => {
    // for get method, use req.query.whatever request
	const book = JSON.parse(req.query.bookinfo);
	res.render('updateBooks', {book});
});

app.post('/updateBooks', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            return res.render('updateBooks', { //refers to addBooks.ejs
                results: null, msg: err, filename: null });
        }
        //--------------------------------------------------------------------------------------
        // was giving error before
        // if (!req.file) {
        //     return res.render('updateBooks', {
        //         results: null, msg: 'Error: no file selected', filename: null
        //     });
        // }
        //--------------------------------------------------------------------------------------
        const query = {_id: req.body._id};
        const value = {
            $set: {
                title: req.body.title,
                author: req.body.author,
                price: req.body.price,
                //filename: uploadDir + '/' + req.file.filename,
                //size: req.file.size 
            }           
        };
        // check if a new file is selected
        if(req.file){
            value.$set.filename = uploadDir + '/' + req.file.filename;
            value.$set.size = req.file.size
            var book = Product.findById(req.body._id, (err, book) => {
                fs.unlink(book.filename, (err) => {
                    if (err) {
                        // what should I do?
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

// to delete
// delete the file from the /public/uploads directory
app.get('/removeBooks', (req, res) => {
    var book = Product.findById(req.query._id, (err, book) => {
       //console.log(book);
       // console.log(req.query);
        fs.unlink(book.filename, (err) => {
            if (err) {
                // what should I do?
                throw err;
            }
        }); 
    }); 
	book.remove( (err, book) => {
		if (err) {
			return res.status(500).send('<h1>Book Delete error</h1>');
        } 
        res.redirect('/adminPage');
	});
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log('Server started at port', port);
});