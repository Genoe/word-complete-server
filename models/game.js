const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    _playerOneId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    _playerTwoId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    playerOneWords: [String],
    plyaerTwoWords: [String],
});

module.exports = mongoose.model('gameSchema', gameSchema);
