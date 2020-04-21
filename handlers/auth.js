const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const db = require('../models'); // looks for index.js by default
const errorFormatter = require('./errorFormat');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
        const { id, username } = user;

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

exports.resetpassword = async function resetpassword(req, res, next) {
    try {
        const validationErrors = validationResult(req).formatWith(errorFormatter);

        if (!validationErrors.isEmpty()) {
            return next({
                status: 422,
                message: validationErrors.array(),
            });
        }

        // find a user
        const user = await db.User.findOne({
            email: req.body.email,
        });

        if (user) {
            const resetToken = await db.PwdResetToken.create({
                _userId: user.id,
                resetToken: crypto.randomBytes(16).toString('hex'),
            });

            const url = `https://wordcompleteonline.com/resetpassword/${resetToken.resetToken}`;
            const msg = {
                to: user.email,
                from: 'passwordreset@wordcompleteonline.com',
                subject: 'Reset Password DO NOT REPLY',
                text: `Reset password for wordcompleteonline.com by clicking here or 
                    copying the link into your browser: ${url}`,
                html: `<p>You are receiving this email because you (or someone else) has requested the reset of the 
                    password for your account.</p>
                    <p>Please click on the following link,
                    or paste this into your browser to complete the process: ${url}</p>`,
            };

            sgMail.send(msg);

            return res.status(200).json({
                message: 'Please Check Your Email',
            });
        }

        return next({
            status: 400,
            message: 'Sorry, but there is no account with this email. Please check for typos and try again.',
        });
    } catch (err) {
        console.log(err);
        return next({
            status: 400,
            message: 'There was an error with the request. Please try again later.',
        });
    }
};
