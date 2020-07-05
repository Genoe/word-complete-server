const express = require('express');
const {
    signup,
    signin,
    reqPwdReset,
    pwdReset,
} = require('../handlers/auth');
const validations = require('./validationRules');
const { validateRecaptcha } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', validations, validateRecaptcha, signup);
router.post('/signin', validateRecaptcha, signin);
router.post('/resetpassword', validations[0], validateRecaptcha, reqPwdReset);
router.put('/resetpassword', validations[1], validateRecaptcha, pwdReset);

module.exports = router;
