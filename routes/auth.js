const express = require('express');
const {
    signup,
    signin,
    reqPwdReset,
    pwdReset,
} = require('../handlers/auth');
const validations = require('./validationRules');

const router = express.Router();

router.post('/signup', validations, signup);
router.post('/signin', signin);
router.post('/resetpassword', validations[0], reqPwdReset);
router.put('/resetpassword', validations[1], pwdReset);

module.exports = router;
