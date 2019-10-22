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
        const { id, username, email } = user;

        // create a token (signing a token)
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
            email,
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

exports.signin = async function signin(req, res, next) {
    try {
        let id;
        let username;
        let isMatch = false;

        // find a user
        const user = await db.User.findOne({
            email: req.body.email,
        });

        if (user) {
            id = user.id;
            username = user.username;
            isMatch = await user.comparePassword(req.body.password, next);
        }

        if (isMatch) {
            const token = jwt.sign({
                id,
                username,
            },
            process.env.SECRET_KEY);

            return res.status(200).json({
                id,
                username,
                token,
            });
        }

        return next({
            status: 400,
            message: 'Invalid Email/Password',
        });
    } catch (err) {
        return next({
            status: 400,
            message: 'Error. Invalid Email/Password',
        });
    }
};
