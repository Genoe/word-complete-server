const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../models'); // looks for index.js by default

const errorFormatter = ({ msg }) => `${msg}`;

exports.signup = async function signup(req, res, next) {
    try {
        const validationErrors = validationResult(req).formatWith(errorFormatter);
        if (!validationErrors.isEmpty()) {
            return next({
                status: 422,
                message: validationErrors.array(),
            });
        }

        // create a user
        const user = await db.User.create(req.body);
        const { id, username, profileImageUrl } = user;

        // create a token (signing a token)
        const token = jwt.sign(
            {
                id,
                username,
                profileImageUrl,
            },
            process.env.SECRET_KEY,
        );

        return res.status(200).json({
            id,
            username,
            profileImageUrl,
            token,
        });
    } catch (err) {
        /**
         * see what kind of err. If it's a certain error, respond with username/email already taken.
         * Otherwise, generic 400 error.
         * 11000 is a mongo error meaning the validation requirements in the schema (unique, required, etc) didn't pass
         */
        if (err.code === 11000) {
            err.message = 'Sorry, that username and/or email is taken';
        }

        return next({
            status: 400,
            message: err.message,
        });
    }
};
