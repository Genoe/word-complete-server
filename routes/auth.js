const express = require('express');
const { signup, signin } = require('../handlers/auth');
const validations = require('./validationRules');

const router = express.Router();

router.post('/signup', validations, signup);
router.post('/signin', signin);

module.exports = router;
