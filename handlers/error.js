// Middleware for handing errors
function errorHandler(error, request, response) { // next param not being used
    return response.status(error.status || 500).json({
        error: {
            message: error.message || 'Oops! Something went wrong.',
        },
    });
}

module.exports = errorHandler;
