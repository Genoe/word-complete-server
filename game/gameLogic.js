const users = require('./users');

/**
 * This module serves as a layer between the users module and socketIO sever.
 */


module.exports.setUpMatch = function setUpMatch(sockId, username) {
    const matchedUserId = users.matchUsers(sockId);
    const matchData = {
        userMsg: null,
        oppMsg: null,
        isTurn: users.getUser(sockId).isTurn,
        oppIsTurn: users.getUser(matchedUserId).isTurn,
        oppUsername: users.getUser(matchedUserId).username,
        oppUserId: matchedUserId,
    };

    users.addUser(sockId, username);

    if (matchedUserId) {
        let matchMsg;

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

        return matchData;
    }

    return false;
};

module.exports.getMatchData = function getMatchFoundData(sockId) {

};
