const express = require('express');
const {
    signup,
    signin,
    reqPwdReset,
    pwdReset,
} = require('../handlers/auth');
const validations = require('./validationRules');
const { validateRecaptcha, validateFields, checkPwdConfirm } = require('../middleware/validation');

const router = express.Router();

router.post('/signup', validations, validateFields, checkPwdConfirm, validateRecaptcha, signup);
router.post('/signin', validateRecaptcha, validateFields, signin);
router.post('/resetpassword', validations[0], validateFields, validateRecaptcha, reqPwdReset);
router.put('/resetpassword', validations[1], validateFields, checkPwdConfirm, validateRecaptcha, pwdReset);

module.exports = router;
