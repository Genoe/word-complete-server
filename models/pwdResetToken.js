const mongoose = require('mongoose');

const pwdResetTokenSchema = new mongoose.Schema({
    _userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    resetToken: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now,
        expires: 14400, // the document will be deleted by mongo after 4 hours
    },
});

module.exports = mongoose.model('pwdResetToken', pwdResetTokenSchema);
