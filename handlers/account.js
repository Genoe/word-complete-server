require('dotenv').config();

const jwt = require('jsonwebtoken');
const db = require('../models');

exports.updateUsername = async function updateUsername(req, res, next) {
    try {
        const user = await db.User.findByIdAndUpdate(
            req.params.id,
            {
                username: req.body.username,
            },
            {
                new: true,
            },
        );

        const { id, username } = user;

        // create a token (signing a token) need to send a new token with the new username
        const token = jwt.sign(
            {
                id,
                username,
            },
            process.env.SECRET_KEY,
        );

        return res.status(200).json({
            id,
            username,
            token,
        });
    } catch (err) {
        /**
         * see what kind of err. If it's a certain error, respond with username/email already taken.
         * Otherwise, generic 400 error.
         * 11000 is a mongo error meaning the validation requirements in the schema (unique, required, etc) didn't pass
         */
        if (err.code === 11000) {
            err.message = 'Sorry, that username is taken';
        }

        return next({
            status: 400,
            message: err.message,
        });
    }
};
