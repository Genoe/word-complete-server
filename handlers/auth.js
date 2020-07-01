require('dotenv').config();
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const axios = require('axios');
const querystring = require('querystring');
const db = require('../models'); // looks for index.js by default
const errorFormatter = require('./errorFormat');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function validateRecaptcha(req) {
    let errMsg;
    let verify = { success: true };

    if (req.body.captchaToken) {
        const captchaData = querystring.stringify({
            secret: process.env.RECAPTCHA_SECRET,
            response: req.body.captchaToken,
            remoteip: req.connection.remoteAddress,
        });

        verify = await axios({
            method: 'post',
            url: 'https://www.google.com/recaptcha/api/siteverify',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: captchaData,
        });

        console.log('RECAPTCHA RESULT', verify.data);
        verify.success = verify.data.success;
    } else {
        verify.success = false;
    }

    if (!verify.success) {
        errMsg = 'Please successfully complete the ReCaptcha';
    }

    return {
        success: verify.success,
        errMsg,
    };
}

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

        console.log('LOG IN REQUEST', req.body);

        const recaptcha = await validateRecaptcha(req);

        console.log('RECAPCHA VERIFICATION', recaptcha);

        if (!recaptcha.success) {
            return next({
                status: 400,
                message: recaptcha.errMsg,
            });
        }

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

exports.reqPwdReset = async function resetpassword(req, res, next) {
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

exports.pwdReset = async function reqPwdReset(req, res, next) {
    try {
        const validationErrors = validationResult(req).formatWith(errorFormatter);

        if (!validationErrors.isEmpty()) {
            return next({
                status: 422,
                message: validationErrors.array(),
            });
        }

        if (req.body.password !== req.body.passwordConfirm) {
            return next({
                status: 422,
                message: 'Passwords do not match.',
            });
        }

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
