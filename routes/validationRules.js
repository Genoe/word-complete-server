const { check } = require('express-validator');

const validations = [
    check('email').isEmail()
        .withMessage('Please Enter a Valid Email Address'),

    check('password').isLength({ min: 8 })
        .withMessage('Password Must Be At Least 8 Characters Long'),

    check('username').isLength({ min: 5, max: 20 })
        .withMessage('Username Must Be Between 5 and 20 Characters'),
];

module.exports = validations;
