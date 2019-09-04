// Middleware for handing errors
// eslint-disable-next-line no-unused-vars
function errorHandler(error, request, response, next) { // next param not being used. Express needs to see this as a function with 4 params
    return response.status(error.status || 500).json({
        error: {
            message: error.message || 'Oops! Something went wrong.',
        },
    });
}

module.exports = errorHandler;
