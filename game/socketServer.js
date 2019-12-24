require('dotenv').config();
const { loginRequired } = require('../middleware/io_auth');
const gameLogic = require('./gameLogic');

const words = new Set();

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
    // supply the jwt to connect to socket.io
    io.use(loginRequired);

    /**
     * @param {SocketIO.Socket} socket
     */
    io.sockets.on('connection', (socket) => {
        console.log('a user connected');

        socket.on('username', (username) => {
            console.log(`User: ${username} has connected`);

            const matchData = gameLogic.setUpMatch(socket.id, username);

            if (matchData.foundMatch) {
                socket.emit('pending', matchData.userMsg);
                socket.emit(
                    'match found',
                    {
                        oppUsername: matchData.oppUsername,
                        isTurn: matchData.isTurn,
                    },
                );

                socket.broadcast.to(matchData.oppUserId).emit('pending', matchData.oppMsg);
                socket.broadcast.to(matchData.oppUserId).emit(
                    'match found',
                    {
                        oppUsername: username,
                        isTurn: matchData.oppIsTurn,
                    },
                );
            } else {
                socket.emit(
                    'pending',
                    matchData.userMsg,
                );
            }
        });

        socket.on('chat message', (rawMsg) => {
            const { oppenentId: oppId, isTurn } = users.getUser(socket.id);
            const msg = rawMsg.toLowerCase().trim();

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
                            msg: `CONGRATULATIONS YOU HAVE DEFEATED 
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
