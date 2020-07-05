const querystring = require('querystring');
const axios = require('axios');
const { validationResult } = require('express-validator');

const errorFormatter = ({ msg }) => `${msg}`;

exports.validateFields = function validateFields(req, res, next) {
    const validationErrors = validationResult(req).formatWith(errorFormatter);

    if (validationErrors.isEmpty()) {
        return next();
    }

    return next({
        status: 422,
        message: validationErrors.array(),
    });
};

exports.validateRecaptcha = async function validateRecaptcha(req, res, next) {
    let errMsg;
    let verify = { success: true };
    console.log('IN RECAPTCHA VAL', req.body);
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
        return next({
            status: 401,
            message: errMsg,
        });
    }

    return next();
};
