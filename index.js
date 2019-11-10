require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const io = require('socket.io')();
const errorHandler = require('./handlers/error');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const { loginRequired, ensureCorrectUser } = require('./middleware/auth');

const app = express();
const users = {};

app.use(cors());
app.use(bodyParser.json());

// the routes specified in authRoutes will all be under /api/auth
app.use('/api/auth', authRoutes);
app.use(
    '/api/users/:id/account',
    loginRequired,
    ensureCorrectUser,
    accountRoutes,
);

// If we pass a parameter to next, express interprets that as us saying there is an error and
// goes to the errorHandler, which is identified as a function with 4 paramers (error, req, res, next)
app.use(errorHandler);

app.listen(process.env.PORT, () => {
    console.log(`Server has started on port ${process.env.PORT}`);
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('username', (username) => {
        console.log(`User: ${username} has connected`);

        const matchedUserId = Object.keys(users).find((key) => users[key].pending);

        users[socket.id] = {
            username,
            pending: true, // is this user waiting to be matched up? TODO: Just rely on opponentId being false/falsy?
            oppenentId: null, // When users disconnect, delete that user and set their opponent's pending to true and opponentId to null
        };
        if (matchedUserId) { // TODO: Handle people leaving but not others joining. Match w/ others who's opponent also left
            socket.emit('pending', `You have been matched with ${users[matchedUserId].username}`);
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
            socket.broadcast.to(users[socket.id].oppenentId).emit('opponent disconnected');
        }

        delete users[socket.id];

        console.log('user disconnected');
        console.log(`Connected Users: ${JSON.stringify(users)}`);
    });
});

io.listen(process.env.IO_PORT);
console.log('socket.io listening on port ', process.env.IO_PORT);

module.exports = app;
