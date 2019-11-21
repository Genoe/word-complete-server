const fs = require('fs');

const MAX_LIVES = 3;
const users = {};
const words = new Set();

// Words come from https://github.com/ciamkr/English-words-list/blob/master/OfficialCrosswords
fs.readFile('./OfficialCrosswords.txt', (err, data) => {
    console.log('generating words list...');
    // eslint-disable-next-line no-throw-literal
    if (err) throw err;

    const splitted = data.toString().split('\r\n');

    splitted.forEach((word) => words.add(word));

    console.log('Finished generating words list!');
});

/**
 * Check if the word starts with the opponents last word's ending letter
 * @param {String} msg // the chat message
 * @param {String} id // SocketIO id of the player
 * @param {String} oppId // SocketIO id of the opponent
 */
function isCharValid(msg, oppId) {
    const { lastWord } = users[oppId];

    if (lastWord) {
        const lastChar = lastWord.slice(lastWord.length - 1);

        return lastChar === msg[0];
    }

    return true;
}

/**
 * Make sure the incoming chat message is valid. If not,
 * return an object with messages and who's turn info for each player
 * @param {String} msg // the chat message
 * @param {String} id // SocketIO id of the player
 * @param {String} oppId // SocketIO id of the opponent
 */
function isBadWord(msg, id, oppId) {
    const { username } = users[id];

    const result = {
        isValid: true,
    };

    if (!words.has(msg)) {
        result.isValid = false;
        users[id].lastWord = users[oppId].lastWord; // Keep going with the same word until someone says something valid

        result[id] = {};
        result[id].msg = `${msg} is not a word! Lose a turn!`;
        result[id].isTurn = false;

        result[oppId] = {};
        result[oppId].msg = `${username} said ${msg} which is not a word! Your turn!`;
        result[oppId].isTurn = true;
    } else if (!isCharValid(msg, oppId)) {
        const { lastWord } = users[oppId];
        const oppLastLetter = users[oppId].lastWord.slice(lastWord.length - 1);
        let oppMsg = `${username} said ${msg} which does not begin with ${oppLastLetter}! Your turn!`;

        // if player 1 says a word and player 2 says a invalid word, then player 1 can still choose
        // any word they want. After player 1 submits a word, player2's lastWord will be null yet.
        // This means isCharValid will return true for any word player1 submits.
        if (users[id].lastWord) {
            oppMsg += ` Choose a word that starts with: ${oppLastLetter}`;
            users[id].lastWord = users[oppId].lastWord; // Keep going with the same word until someone says something valid
        }

        result.isValid = false;

        result[id] = {};
        result[id].msg = `${msg} does not begin with ${oppLastLetter}! Lose a turn!`;
        result[id].isTurn = false;

        result[oppId] = {};
        result[oppId].msg = oppMsg;
        result[oppId].isTurn = true;
    } else if (users[id].words.has(msg) || users[oppId].words.has(msg)) {
        result.isValid = false;

        users[id].lastWord = users[oppId].lastWord; // Keep going with the same word until someone says something valid
        result[id] = {};
        result[id].msg = `${msg} has already been used! Lose a turn!`;
        result[id].isTurn = false;

        result[oppId] = {};
        result[oppId].msg = `${username} said ${msg} which has already been used! Your turn!`;
        result[oppId].isTurn = true;
    }

    return result;
}

/**
 * Set up all events for the Socket IO server
 * @param {SocketIO.Server} io
 */
function ioServer(io) {
    /**
     * @param {SocketIO.Socket} socket
     */
    io.sockets.on('connection', (socket) => {
        console.log('a user connected');

        socket.on('username', (username) => {
            console.log(`User: ${username} has connected`);

            const matchedUserId = Object.keys(users).find((key) => users[key].pending);

            users[socket.id] = {
                username,
                pending: true, // is this user waiting to be matched up? TODO: Just rely on opponentId being false/falsy?
                oppenentId: null, // When users disconnect, delete that user and set their opponent's pending to true and opponentId to null
                isTurn: null,
                lastWord: null,
                words: new Set(),
                lives: MAX_LIVES,
            };
            if (matchedUserId) {
                socket.emit(
                    'pending',
                    `You have been matched with ${users[matchedUserId].username}`,
                );

                // one player goes first. The other, second.
                users[socket.id].isTurn = Math.random() >= 0.5;
                users[matchedUserId].isTurn = !users[socket.id].isTurn;

                socket.emit(
                    'match found',
                    {
                        oppUsername: users[matchedUserId].username,
                        isTurn: users[socket.id].isTurn,
                    },
                );
                socket.broadcast.to(matchedUserId).emit(
                    'pending',
                    `You have been matched with ${username}`,
                );
                socket.broadcast.to(matchedUserId).emit(
                    'match found',
                    {
                        oppUsername: username,
                        isTurn: users[matchedUserId].isTurn,
                    },
                );
                users[socket.id].oppenentId = matchedUserId;
                users[socket.id].pending = false;
                users[matchedUserId].oppenentId = socket.id;
                users[matchedUserId].pending = false;
                console.log('USERS', JSON.stringify(users));
            } else {
                socket.emit(
                    'pending',
                    `Hello ${username}. Plese wait for our matchmaking sauce to finish...`,
                );
            }
        });

        socket.on('chat message', (rawMsg) => {
            const { oppenentId: oppId, isTurn } = users[socket.id];
            const msg = rawMsg.toLowerCase();

            console.log('USERS_CHAT_MESSAGE', JSON.stringify(users));
            console.log(`message: ${msg}`);

            // Do nothing if it is not their turn. As of now, this should only be possible if they are messing
            // with the game in the browser or using other tools.
            if (!isTurn) {
                console.log('Player submitted when it was not their turn!');
            } else {
                // user can lose a turn if it's not a word or doesn't match the ending letter of the previous word
                const result = isBadWord(msg, socket.id, oppId);

                if (result.isValid) {
                    socket.broadcast.to(oppId).emit('chat message', msg);
                    users[socket.id].lastWord = msg;
                    users[socket.id].words.add(msg);
                } else if (!result.isValid) {
                    socket.emit('bad word', {
                        msg: result[socket.id].msg,
                        isTurn: result[socket.id].isTurn,
                    });
                    socket.broadcast.to(oppId).emit('bad word', {
                        msg: result[oppId].msg,
                        isTurn: result[oppId].isTurn,
                    });

                    users[socket.id].lives -= 1;

                    if (users[socket.id].lives === 0) {
                        socket.emit('game over', {
                            msg: `GAME OVER! ${users[oppId].username} HAS WON!`,
                        });
                        socket.broadcast.to(oppId).emit('game over', {
                            msg: `CONGRATULATIONS YOU HAVE BESTED 
                            ${users[socket.id].username} IN A GAME OF WORD-COMPLETE!`,
                        });
                    }
                }
            }

            if (isTurn) {
                users[socket.id].isTurn = !isTurn;
                users[oppId].isTurn = isTurn;
            }
        });

        socket.on('disconnect', () => {
            if (users[socket.id] && users[socket.id].oppenentId) {
                users[users[socket.id].oppenentId].pending = true;
                users[users[socket.id].oppenentId].oppenentId = null;
                socket.broadcast.to(users[socket.id].oppenentId).emit('opponent disconnected');
            }

            delete users[socket.id];

            console.log('user disconnected');
            console.log(`Connected Users: ${JSON.stringify(users)}`);
        });
    });
}

module.exports = ioServer;
