require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const errorHandler = require('./handlers/error');
const authRoutes = require('./routes/auth');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// the routes specified in authRoutes will all be under /api/auth
app.use('/api/auth', authRoutes);

// If we pass a parameter to next, express interprets that as us saying there is an error and
// goes to the errorHandler, which is identified as a function with 4 paramers (error, req, res, next)
app.use(errorHandler);

app.listen(process.env.PORT, () => {
    console.log(`Server has started on port ${process.env.PORT}`);
});
