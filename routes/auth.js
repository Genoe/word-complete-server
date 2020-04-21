const express = require('express');
const { signup, signin, resetpassword } = require('../handlers/auth');
const validations = require('./validationRules');

const router = express.Router();

router.post('/signup', validations, signup);
router.post('/signin', signin);
router.post('/resetpassword', validations[0], resetpassword);

module.exports = router;
