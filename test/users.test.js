/* eslint-env mocha */
require('dotenv').config();

process.env.DB_URL = 'mongodb://localhost/word-complete-test';
process.env.PORT = 8090;

const request = require('supertest');
const { expect } = require('chai');
const { User } = require('../models');
const app = require('../index');

describe('api/auth', () => {
    beforeEach(async () => {
        await User.deleteMany({});
    });

    describe('POST api/users/signup', () => {
        it('Should create a new user', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'potatoes',
                    password: 'morepotatoes',
                    email: 'potatoes@potatoes.com',
                });
            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('username', 'potatoes');
            expect(res.body).to.have.property('id');
            expect(res.body).to.have.property('token');
        });
    });
});
