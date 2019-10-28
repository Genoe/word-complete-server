const express = require('express');
const validations = require('./validationRules');
const { updateUsername } = require('../handlers/account');

const router = express.Router({ mergeParams: true });

// prefix: /api/users/:id/  -> mergeParams allows us to get the :id paramter from the parent route
router.route('/').put([validations[2]], updateUsername);

module.exports = router;
