require('dotenv').config();
const express = require('express');

const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');
const errorHandler = require('./handlers/error');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const { loginRequired, ensureCorrectUser } = require('./middleware/auth');

require('./socketServer')(io);

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

// app.use(express.static(path.join(__dirname, 'www')));
// app.get('/*', (req, res) => {
//     res.sendFile(path.join(__dirname, 'www', 'index.html'));
// });

// If we pass a parameter to next, express interprets that as us saying there is an error and
// goes to the errorHandler, which is identified as a function with 4 paramers (error, req, res, next)
app.use(errorHandler);

server.listen(process.env.PORT, () => {
    console.log(`Server has started on port ${process.env.PORT}`);
});

module.exports = app;
