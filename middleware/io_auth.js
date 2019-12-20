require('dotenv').config();
const jwt = require('jsonwebtoken');

exports.loginRequired = function loginRequired(socket, next) {
    try {
        const token = socket.handshake.headers.authorization.split(' ')[1];

        jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
            if (decoded) {
                console.log('socket io authenticated!');
                return next();
            }
            console.log('socket io NOT authenticated!', err);
            return next(new Error('Please log in first'));
        });
    } catch (err) {
        console.log('socket io NOT authenticated! (token missing/error)', err);
        return next(new Error('Please log in first'));
    }

    return next(new Error('Chat Auth Error!'));
};
