require('dotenv').config();
const { loginRequired } = require('../middleware/io_auth');
const gameLogic = require('./gameLogic');

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

        socket.use((packet, next) => {
            console.log('PACKET', packet);
            if (packet[0] === 'chat message' && packet[1] === '') {
                console.log('User submitted an empty string');
                return next(new Error('User submitted an empty string')); // error event on client
            }

            return next();
        });

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
                        lives: matchData.lives,
                    },
                );

                socket.broadcast.to(matchData.oppUserId).emit('pending', matchData.oppMsg);
                socket.broadcast.to(matchData.oppUserId).emit(
                    'match found',
                    {
                        oppUsername: username,
                        isTurn: matchData.oppIsTurn,
                        lives: matchData.lives,
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
            const result = gameLogic.validateMessage(rawMsg, socket.id);

            if (result.gameOver) {
                socket.emit('game over', {
                    msg: result.resp,
                });
                socket.broadcast.to(result.oppId).emit('game over', {
                    msg: result.oppResp,
                });
            } else if (result.isBadWord) {
                socket.emit('bad word', {
                    msg: result.resp,
                    isTurn: result.isTurn,
                    lives: result.lives,
                });
                socket.broadcast.to(result.oppId).emit('bad word', {
                    msg: result.oppResp,
                    isTurn: result.oppIsTurn,
                });
            } else { // valid word
                socket.broadcast.to(result.oppId).emit('chat message', result.oppResp);
            }
        });

        socket.on('timer end', () => {
            const result = gameLogic.swapTurnsTimer(socket.id);

            if (result.gameOver) {
                socket.emit('game over', {
                    msg: result.resp,
                });
                socket.broadcast.to(result.oppId).emit('game over', {
                    msg: result.oppResp,
                });
            } else {
                socket.emit('bad word', {
                    msg: result.resp,
                    isTurn: result.isTurn,
                    lives: result.lives,
                });

                socket.broadcast.to(result.oppId).emit('bad word', {
                    msg: result.oppResp,
                    isTurn: result.oppIsTurn,
                });
            }
        });

        socket.on('disconnect', () => {
            const oppId = gameLogic.removeUser(socket.id);

            if (oppId) {
                socket.broadcast.to(oppId).emit('opponent disconnected');
            }
        });
    });
}

module.exports = ioServer;
