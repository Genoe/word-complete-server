// Middleware for handing errors. Always send errors as an array for consistency.
// eslint-disable-next-line no-unused-vars
function errorHandler(error, request, response, next) { // next param not being used. Express needs to see this as a function with 4 params
    let errMsg;

    if (error.message && typeof error.message === 'string') {
        errMsg = [error.message];
    } else if (!error.message) {
        errMsg = 'Oops! Something went wrong.';
    } else {
        errMsg = error.message;
    }

    return response.status(error.status || 500).json({
        error: {
            message: errMsg,
        },
    });
}

module.exports = errorHandler;
