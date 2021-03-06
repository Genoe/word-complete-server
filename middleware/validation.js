const querystring = require('querystring');
const axios = require('axios').default;
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

exports.checkPwdConfirm = function checkPwdConfirm(req, res, next) {
    if (req.body.password === req.body.passwordConfirm) {
        return next();
    }

    return next({
        status: 422,
        message: 'Passwords do not match',
    });
};

exports.validateRecaptcha = async function validateRecaptcha(req, res, next) {
    let validateReq;
    const verify = { success: true };

    if (req.body.captchaToken) {
        const ip = ((req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.connection.remoteAddress);
        const captchaData = querystring.stringify({
            secret: process.env.RECAPTCHA_SECRET,
            response: req.body.captchaToken,
            remoteip: ip,
        });

        console.log('USER IP ADDRESS', ip);

        try {
            validateReq = await axios({
                method: 'post',
                url: 'https://www.google.com/recaptcha/api/siteverify',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data: captchaData,
            });

            console.log('RECAPTCHA RESULT', validateReq.data);
            verify.success = validateReq.data.success;

            if (!verify.success && validateReq.data['error-codes'][0] === 'timeout-or-duplicate') {
                verify.errMsg = 'Verification expired. Please check the checkbox again.';
            }
        } catch (e) {
            console.log('ERROR REQUESTING CAPTCHA VALIDATION', e);
            verify.success = false;
            verify.errMsg = 'There was an issue validating the checkbox. Please try again later.';
        }
    } else {
        verify.success = false;
    }

    if (!verify.success) {
        verify.errMsg = verify.errMsg || 'Please successfully check the checkbox';

        return next({
            status: 401,
            message: verify.errMsg,
        });
    }

    return next();
};
