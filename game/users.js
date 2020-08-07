const MAX_LIVES = 3;
const users = {};

class User {
    constructor(username, mongoId) {
        this.mongoId = mongoId;
        this.username = username;
        this.pending = true; // is this user waiting to be matched up? TODO: Just rely on opponentId being false/falsy?
        this.opponentId = null; // When users disconnect, delete that user and set their opponent's pending to true and opponentId to null
        this.isTurn = null;
        this.lastWord = null;
        this.words = new Set();
        this.lives = MAX_LIVES;
        this.deadline = null;
    }
}

/**
 * Find an opponent with a status of pending. Return the socketio id of that user
 * If nothing is found, undefind is returned
 * @param {SocketIO.Socket.id} sockId Id of the user we are finding an opponent for.
 * @returns {SocketIO.Socket.id}
 */
function findOpponent(sockId) {
    return Object.keys(users).find((key) => key !== sockId && users[key].pending);
}

/**
 * Add a new user to our users object. Use socket id for fast
 * lookup when socketIO events are sent or received
 * @param {SocketIO.Socket.id} socketId socketIO socket id
 * @param {String} username username created by the user
 * @param {String} mongoId The users Id in the Mongo database
 */
module.exports.addUser = function addUser(socketId, username, mongoId) {
    users[socketId] = new User(username, mongoId);
};

/**
 * Find an opponent and decide who's turn it is. Return false if
 * there are no other pending players
 * @param {SocketIO.Socket.id} sockId
 */
module.exports.matchUsers = function matchUsers(sockId) {
    const oppSockId = findOpponent(sockId);

    // one player goes first. The other, second.
    if (oppSockId) {
        const deadline = new Date() + 30000;

        users[sockId].isTurn = Math.random() >= 0.5;
        users[oppSockId].isTurn = !users[sockId].isTurn;

        users[sockId].opponentId = oppSockId;
        users[sockId].pending = false;
        users[oppSockId].opponentId = sockId;
        users[oppSockId].pending = false;

        if (users[sockId].isTurn) {
            users[sockId].deadline = deadline;
        } else {
            users[oppSockId].deadline = deadline;
        }

        return oppSockId;
    }

    return false;
};

/**
 * Return a user in our user object
 * @returns {User}
 */
module.exports.getUser = function getUser(sockId) {
    return users[sockId];
};

/**
 * Remove a user and set any opponent to pending.
 * @param {SocketIO.Socket.id} socketId socketIO socket id
 * @returns {SocketIO.Socket.id} returns the socketIO id of the opponent. False if no opponent
 */
module.exports.removeUser = function removeUser(socketId) {
    if (users[socketId] && users[socketId].opponentId) {
        const oppId = users[socketId].opponentId;
        users[oppId].pending = true;
        users[oppId].opponentId = null;
    }

    delete users[socketId];

    console.log('user disconnected');
    console.log('CONNECTED USERS', users);
};
