/**
 * This module serves as a layer between the users module and socketIO sever.
 */
const fs = require('fs');
const users = require('./users');

const dictionary = new Set();

// Words come from https://github.com/ciamkr/English-words-list/blob/master/OfficialCrosswords
fs.readFile('./OfficialCrosswords.txt', (err, data) => {
    console.log('generating words list...');
    // eslint-disable-next-line no-throw-literal
    if (err) throw err;

    const splitted = data.toString().split('\n');

    splitted.forEach((word) => dictionary.add(word));

    console.log('Finished generating words list!');
});

/**
 * Add the user to our users object and find a match. If there is nobody to
 * match up with, return a message that can be sent to the user.
 * @param {SocketIO.Socket.id} sockId SocketIO id of the user
 * @param {String} username The users chosen username
 */
module.exports.setUpMatch = function setUpMatch(sockId, username) {
    users.addUser(sockId, username);

    const matchedUserId = users.matchUsers(sockId);

    const matchData = {
        userMsg: null,
        oppMsg: null,
        foundMatch: !!matchedUserId,
        isTurn: null,
        oppIsTurn: null,
        oppUsername: null,
        oppUserId: matchedUserId,
        lives: null,
        oppLives: null,
    };

    if (matchedUserId) {
        let matchMsg;

        matchData.isTurn = users.getUser(sockId).isTurn;
        matchData.oppIsTurn = users.getUser(matchedUserId).isTurn;
        matchData.oppUsername = users.getUser(matchedUserId).username;

        // Emit 'pending' and then 'match found' to each player
        matchMsg = `You have been matched with ${users.getUser(matchedUserId).username}`;
        if (users.getUser(sockId).isTurn) { // set up by users.matchUsers
            matchMsg += ' Please send the first word!';
        } else {
            matchMsg += ' Please wait for your opponent to send the first word!';
        }

        matchData.userMsg = matchMsg;

        matchMsg = `You have been matched with ${username}`;
        if (users.getUser(matchedUserId).isTurn) {
            matchMsg += ' Please send the first word!';
        } else {
            matchMsg += ' Please wait for your opponent to send the first word!';
        }

        matchData.oppMsg = matchMsg;

        matchData.lives = users.getUser(sockId).lives;
        matchData.oppLives = users.getUser(sockId).lives;
    } else {
        matchData.userMsg = `Hello ${username}! Plese wait for an opponent to be found...`;
    }

    return matchData;
};

/**
 * Check if the word starts with the opponents last word's ending letter
 * @param {String} msg // the chat message
 * @param {String} id // SocketIO id of the player
 * @param {String} oppId // SocketIO id of the opponent
 */
function isCharValid(msg, oppId) {
    const { lastWord } = users.getUser(oppId);

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
    const { username } = users.getUser(id);

    const result = {
        isValid: true,
    };

    if (!dictionary.has(msg)) {
        result.isValid = false;
        users.getUser(id).lastWord = users.getUser(oppId).lastWord; // Keep going with the same word until someone says something valid

        result[id] = {};
        result[id].msg = `${msg} is not a word! Lose a turn!`;
        result[id].isTurn = false;

        result[oppId] = {};
        result[oppId].msg = `${username} said ${msg} which is not a word! Your turn!`;
        result[oppId].isTurn = true;
    } else if (!isCharValid(msg, oppId)) {
        const { lastWord } = users.getUser(oppId);
        const oppLastLetter = users.getUser(oppId).lastWord.slice(lastWord.length - 1);
        let oppMsg = `${username} said ${msg} which does not begin with ${oppLastLetter}! Your turn!`;

        // if player 1 says a word and player 2 says a invalid word, then player 1 can still choose
        // any word they want. After player 1 submits a word, player2's lastWord will be null yet.
        // This means isCharValid will return true for any word player1 submits.
        if (users.getUser(id).lastWord) {
            oppMsg += ` Choose a word that starts with: ${oppLastLetter}`;
            users.getUser(id).lastWord = users.getUser(oppId).lastWord; // Keep going with the same word until someone says something valid
        }

        result.isValid = false;

        result[id] = {};
        result[id].msg = `${msg} does not begin with ${oppLastLetter}! Lose a turn!`;
        result[id].isTurn = false;

        result[oppId] = {};
        result[oppId].msg = oppMsg;
        result[oppId].isTurn = true;
    } else if (users.getUser(id).words.has(msg) || users.getUser(oppId).words.has(msg)) {
        result.isValid = false;

        users.getUser(id).lastWord = users.getUser(oppId).lastWord; // Keep going with the same word until someone says something valid
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
 * Give users new deadlines
 * @param {SocketIO.Socket.id} user
 * @param {SocketIO.Socket.id} opponent
 */
function setChatDeadline(sockId, oppSockId) {
    const user = users.getUser(sockId);
    const opponent = users.getUser(oppSockId);

    user.deadline = null;
    opponent.deadline = new Date() + 30000;

    // console.log('DEADLINE', JSON.stringify(user), JSON.stringify(opponent));
}

/**
 * A function to swap turns after a user runs out of time
 */
module.exports.swapTurnsTimer = function swapTurnsTimer(sockId) {
    const {
        oppenentId: oppId,
        isTurn,
        username,
    } = users.getUser(sockId);
    const { username: oppUsername } = users.getUser(oppId);

    const responses = {
        resp: null,
        isTurn: null,
        lives: null,
        oppResp: null,
        oppIsTurn: null,
        gameOver: false,
        oppId,
    };

    console.log('USERS_CHAT_MESSAGE', JSON.stringify(users));

    // Do nothing if it is not their turn. As of now, this should only be possible if they are messing
    // with the game in the browser or using other tools.
    if (!isTurn) {
        console.log('Player submitted when it was not their turn!');
    } else {
        responses.isBadWord = true;
        responses.resp = `You ran out of time! ${oppUsername}s turn!`;
        responses.isTurn = false;
        users.getUser(sockId).isTurn = false;

        responses.oppResp = `${username} ran out of time! Your turn!`;
        responses.oppIsTurn = true;
        users.getUser(oppId).isTurn = true;

        users.getUser(sockId).lives -= 1;
        responses.lives = users.getUser(sockId).lives;
        setChatDeadline(sockId, oppId);

        // Player ran out of time, now their opponent has to choose a new word based on the opponents own last word.
        users.getUser(sockId).lastWord = users.getUser(oppId).lastWord;

        if (users.getUser(sockId).lives === 0) {
            responses.gameOver = true;
            responses.resp = `GAME OVER! ${oppUsername} HAS WON!`;
            responses.oppResp = `CONGRATULATIONS YOU HAVE DEFEATED ${username} IN A GAME OF WORD-COMPLETE!`;
        }
    }

    return responses;
};

/**
 * Validate the incoming chat message. Return responses for both user and
 * opponent, including game over.
 * @param {String} rawMsg incoming chat message
 * @param {SocketIO.Socket.id} sockid Socket.io id of the user who sent the chat message
 */
module.exports.validateMessage = function validateMessage(rawMsg, sockId) {
    const {
        oppenentId: oppId,
        isTurn,
        username,
        words,
        deadline,
    } = users.getUser(sockId);
    const { username: oppUsername } = users.getUser(oppId);
    const msg = rawMsg.toLowerCase().trim();
    const responses = {
        resp: null,
        isTurn: null,
        lives: null,
        oppResp: null,
        oppIsTurn: null,
        gameOver: false,
        isBadWord: false,
        oppId,
    };

    console.log(`message: ${msg}`);

    // Do nothing if it is not their turn. As of now, this should only be possible if they are messing
    // with the game in the browser or using other tools.
    if (!isTurn) {
        console.log('Player submitted when it was not their turn!');
    } else if (deadline > new Date()) {
        console.log('Player submitted a message later than they should have!'); // front end UI should not allow this
    } else {
        // user can lose a turn if it's not a word or doesn't match the ending letter of the previous word
        const result = isBadWord(msg, sockId, oppId);

        if (result.isValid) {
            responses.oppResp = msg; // socket.broadcast.to(oppId).emit('chat message', msg);
            users.getUser(sockId).lastWord = msg;
            words.add(msg);
        } else if (!result.isValid) {
            responses.isBadWord = true;
            responses.resp = result[sockId].msg;
            responses.isTurn = result[sockId].isTurn;

            responses.oppResp = result[oppId].msg;
            responses.oppIsTurn = result[oppId].isTurn;
            users.getUser(sockId).lives -= 1;
            responses.lives = users.getUser(sockId).lives;

            if (users.getUser(sockId).lives === 0) {
                responses.gameOver = true;
                responses.resp = `GAME OVER! ${oppUsername} HAS WON!`;
                responses.oppResp = `CONGRATULATIONS YOU HAVE DEFEATED ${username} IN A GAME OF WORD-COMPLETE!`;
            }
        }
    }
    // TODO: consider putting the check for 0 lives out here
    if (isTurn) {
        setChatDeadline(sockId, oppId);
        users.getUser(sockId).isTurn = !isTurn;
        users.getUser(oppId).isTurn = isTurn;
    }

    return responses;
};

/**
 * Remove the user
 * @param {SocketIO.Socket.id} sockid Socket.io id of the user to remove
 * @returns {SocketIO.Socket.id}  return the opponent id, false if no opponent
 */
module.exports.removeUser = function removeUser(sockId) {
    return users.removeUser(sockId);
};
