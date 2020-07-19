require('dotenv').config();
const { loginRequired } = require('../middleware/io_auth');
const gameLogic = require('./gameLogic');

/**
 * Send the "game over" event to both players
 * and store the game in the database
 * @param {SocketIO.Socket} socket The socket connection
 * @param {String} playerMsg The messsage to be sent to the player who lost
 * @param {String} oppMsg The message to be sent to the opponent
 * @param {SocketIO.Socket.id} oppSockId The SocketIO ID of the opponent
 */
function endGame(socket, playerMsg, oppMsg, oppSockId) {
    socket.emit('game over', {
        msg: playerMsg,
    });
    socket.broadcast.to(oppSockId).emit('game over', {
        msg: oppMsg,
    });

    gameLogic.saveWords(socket.id);
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

        socket.use((packet, next) => {
            console.log('PACKET', packet);
            if (packet[0] === 'chat message' && packet[1] === '') {
                console.log('User submitted an empty string');
                return next(new Error('User submitted an empty string')); // error event on client
            }

            return next();
        });

        socket.on('userdata', ({ username, id: mongoId }) => {
            console.log(`User: ${username} has connected`);

            const matchData = gameLogic.setUpMatch(socket.id, username, mongoId);

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
                endGame(socket, result.resp, result.oppResp, result.oppId);
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
                endGame(socket, result.resp, result.oppResp, result.oppId);
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
