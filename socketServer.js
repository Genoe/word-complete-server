const users = {};

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
            };
            if (matchedUserId) {
                socket.emit(
                    'pending',
                    `You have been matched with ${users[matchedUserId].username}`,
                );
                socket.emit('match found', users[matchedUserId].username);
                socket.broadcast.to(matchedUserId).emit(
                    'pending',
                    `You have been matched with ${username}`,
                );
                socket.broadcast.to(matchedUserId).emit('match found', username);
                users[socket.id].oppenentId = matchedUserId;
                users[socket.id].pending = false;
                users[matchedUserId].oppenentId = socket.id;
                users[matchedUserId].pending = false;
            } else {
                socket.emit(
                    'pending',
                    `Hello ${username}. Plese wait for our matchmaking sauce to finish...`,
                );
            }
        });

        socket.on('chat message', (msg) => {
            console.log(`message: ${msg}`);
            socket.broadcast.to(users[socket.id].oppenentId).emit('chat message', msg);
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
