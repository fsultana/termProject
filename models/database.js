const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const userUri = encodeURIComponent('wsp');
const passUri = encodeURIComponent('password');
const dbname = 'wspdb';
const url = 'mongodb://' + userUri + ':' + passUri + 
            '@localhost:27017/'+dbname+'?authSource='+dbname;

const options = {poolSize: 20};
mongoose.connect(url, options); //connection to database

// check to see if connected to database
mongoose.connection.on( 'connected', console.info.bind(console, 'Mongoose is connected'));

// close connection when app terminates
process.on('SIGINT', () => {
    mongoose.connection.close( () => {
        console.log('Mongoose connection closed due to app termination');
        process.exit(0);
    })
});