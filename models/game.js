const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    _winnerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    _loserId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    winnerWords: [String],
    loserWords: [String],
});

module.exports = mongoose.model('game', gameSchema);
