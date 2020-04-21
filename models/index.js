const mongoose = require('mongoose');

mongoose.set('debug', true); // see the actual mongo queries in the terminal
mongoose.Promise = Promise; // going to use es2017 async, which still use promises under the hood

// TODO: Keep URL somewhere else. Production will be different
mongoose.connect(process.env.DB_URL, {
    keepAlive: true,
    useNewUrlParser: true,
});

// We are "bundling" the code in user.js.
// The idea is to only have to require index.js in other parts of the application instead of
// requiring in each individual file.
module.exports.User = require('./user');
module.exports.PwdResetToken = require('./pwdResetToken');
