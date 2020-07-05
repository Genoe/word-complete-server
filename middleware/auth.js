/* eslint-disable consistent-return */
require('dotenv').config();
const jwt = require('jsonwebtoken');

// make sure the user is logged in - Authentication
// Not using async because the jwt library uses callbacks
exports.loginRequired = function loginRequired(req, res, next) {
    try {
        // one possible way to the catch block is if the user does not supply the authorization header at all. Then
        // headers.authorization will be undefined
        const token = req.headers.authorization.split(' ')[1];

        jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
            if (decoded) {
                return next();
            }
            return next({
                status: 401,
                message: 'Please log in first',
            });
        });
    } catch (err) {
        return next({
            status: 401,
            message: 'Please log in first',
        });
    }
};

// make sure we get the correct user - Authorization
exports.ensureCorrectUser = function ensureCorrectUser(req, res, next) {
    try {
        const token = req.headers.authorization.split(' ')[1];

        jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
            // TODO: Should we check that the username matches as well?
            if (decoded && decoded.id === req.params.id) {
                return next();
            }
            return next({
                status: 401,
                message: 'Unauthorized',
            });
        });
    } catch (err) {
        return next({
            status: 401,
            message: 'Unauthorized',
        });
    }
};
