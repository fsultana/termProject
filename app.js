// minimalistic online store: no real database, no authentication
const express = require('express');
const multer = require('multer');
const ejs = require('ejs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
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


const app = express();
app.set('view engine', 'ejs');
app.set('views', './ejs_views');

// uploadDir must begin with ./public
app.use('/public', express.static(__dirname + '/public'));

app.use(express.urlencoded({extended: false}));
app.use(session({
	secret: 'mysecretkey',
	resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 60*60*1000, // unit: ms, if inactive, session expires in 1 hour
        path: '/'
    }
}));

// run and connect to the database
require('./models/database');
const Product = require('./models/Product');
const ShoppingCart = require('./models/ShoppingCart');
app.locals.store_title = 'MyBroncho Online';

//for the index page links
app.get('/', (req, res) => {
    
    res.render('index', {}); // where to go next
});
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

// to insert books to database
app.get('/addBooks', (req, res) => {
	res.render('addBooks');
});

app.post('/addBooks', (req, res) => {
    
    upload(req, res, (err) => {
        if (err) {
            return res.render('addBooks', { //refers to addBooks.ejs
                results: null, msg: err, filename: null });
        }
        if (!req.file) {
            return res.render('addBooks', {
                results: null, msg: 'Error: no file selected', filename: null
            });
        }
        const newBook = new Product({
            //for post method, always use req.body.whatever user input
            title: req.body.title,  
            author: req.body.author,
            price: req.body.price,
            filename: uploadDir + '/' + req.file.filename,// for image file
            size: req.file.size  
        });
        newBook.save((err, results) => {
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