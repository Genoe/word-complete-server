const fs = require('fs');

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

        socket.on('chat message', (msg) => {
            const { oppenentId, isTurn } = users[socket.id];
            const opponentUsername = users[oppenentId].username;
            const lwrcsMsg = msg.toLowerCase();

            console.log('USERS_CHAT_MESSAGE', JSON.stringify(users));
            console.log(`message: ${lwrcsMsg}`);

            // Do nothing if it is not their turn
            if (!isTurn) {
                console.log('Player submitted when it was not their turn!');
            } else if (words.has(lwrcsMsg)) {
                socket.broadcast.to(oppenentId).emit('chat message', lwrcsMsg);
            } else {
                // user can lose a turn if it's not a word or doesn't match the ending letter of the previous word
                socket.emit(
                    'bad word',
                    {
                        msg: `${lwrcsMsg} is not a word! Lose a turn!`,
                        isTurn: false,
                    },
                );
                socket.broadcast.to(oppenentId).emit(
                    'bad word',
                    {
                        msg: `${opponentUsername} said ${lwrcsMsg} which is not a word! Your turn!`,
                        isTurn: true,
                    },
                );
            }

            if (isTurn) {
                users[socket.id].isTurn = !isTurn;
                users[oppenentId].isTurn = isTurn;
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
