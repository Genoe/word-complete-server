require('dotenv').config();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const db = require('../models'); // looks for index.js by default

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.signup = async function signup(req, res, next) {
    try {
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

        console.log('LOG IN REQUEST', req.body);

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
        console.log(err);
        return next({
            status: 400,
            message: 'Error. Invalid Email/Password',
        });
    }
};

exports.reqPwdReset = async function reqPwdReset(req, res, next) {
    try {
        // find a user
        const user = await db.User.findOne({
            email: req.body.email,
        });

        if (user) {
            const resetToken = await db.PwdResetToken.create({
                _userId: user.id,
                resetToken: crypto.randomBytes(16).toString('hex'),
            });

            const url = `https://wordcompleteonline.com/resetpassword?token=${resetToken.resetToken}`;

            await sgMail.send({
                to: user.email,
                from: {
                    email: 'passwordreset@wordcompleteonline.com',
                    name: 'Word Complete Online',
                },
                templateId: process.env.SENDGRID_PWD_RESET_TEMPLATE,
                dynamicTemplateData: {
                    reset_url: url,
                },
                asm: {
                    groupId: +process.env.SENDGRID_UNSUBSCRIBE_GROUP,
                },
            });

            return res.status(200).json({
                message: ['Please check your email and follow the instructions.', 'You can close this window.'],
            });
        }

        return next({
            status: 400,
            message: 'Sorry, but there is no account with this email. Please check for typos and try again.',
        });
    } catch (err) {
        return next({
            status: 400,
            message: 'There was an error with the request. Please try again later.',
        });
    }
};

exports.pwdReset = async function pwdReset(req, res, next) {
    try {
        const pwdResetToken = await db.PwdResetToken.findOne({ resetToken: req.body.token });

        if (pwdResetToken) {
            // eslint-disable-next-line no-underscore-dangle
            const user = await db.User.findById(pwdResetToken._userId);
            if (user) {
                user.password = req.body.password;
                await user.save(); // save instead of findByIdAndUpdate to trigger pre-save hook
                return res.status(200).json({
                    message: 'Successfully reset password.',
                });
            }
            return next({
                status: 422,
                message: 'No user is associated with this token.',
            });
        }

        return next({
            status: 409,
            message: 'Token has expired',
        });
    } catch (err) {
        return next({
            status: 400,
            message: 'There was an error with the request. Please try again later.',
        });
    }
};
