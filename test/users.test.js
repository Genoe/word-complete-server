/* eslint-env mocha */
require('dotenv').config();

process.env.DB_URL = 'mongodb://localhost/word-complete-test';
process.env.PORT = 8090;

const request = require('supertest');
const { expect } = require('chai');
const { User } = require('../models');
const app = require('../index');

describe('api/auth', () => {
    describe('POST api/auth/users/signup', () => {
        beforeEach(async () => {
            await User.deleteMany({});
        });

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
            expect(res.body).to.have.property('email', 'potatoes@potatoes.com');
        });

        it('Should prompt for a longer password', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'potatoes',
                    password: '1234567',
                    email: 'potatoes@potatoes.com',
                });

            expect(res.status).to.equal(422);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Password Must Be At Least 8 Characters Long');
        });

        it('Should prompt for a longer username', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'po',
                    password: '12345678',
                    email: 'potatoes@potatoes.com',
                });

            expect(res.status).to.equal(422);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Username Must Be Between 5 and 20 Characters');
        });

        it('Should prompt for a vaild email address', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'potatoes',
                    password: '12345678',
                    email: 'potatoes@potatoes',
                });

            expect(res.status).to.equal(422);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Please Enter a Valid Email Address');
        });

        it('Should prompt for a vaild email, username, and password', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({
                    username: '',
                    password: '',
                    email: 'potatoes@potatoes',
                });

            expect(res.status).to.equal(422);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(3).that
                .includes('Please Enter a Valid Email Address')
                .and.includes('Username Must Be Between 5 and 20 Characters')
                .and.includes('Password Must Be At Least 8 Characters Long');
        });
    });

    describe('user already exists', () => {
        before(async () => {
            await User.deleteMany({});

            // create the user that will already exist
            await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'alreadytaken',
                    password: 'morepotatoes',
                    email: 'potatoes@potatoes.com',
                });
        });

        after(async () => {
            await User.deleteMany({});
        });

        it('Should fail to create a user with the same username', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'alreadytaken',
                    password: 'morepotatoes',
                    email: 'potatoes1@potatoes.com',
                });

            // Only sending 422 for vaildation errors from express-validator
            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Sorry, that username and/or email is taken');
        });
    });

    describe('POST api/auth/users/signin', () => {
        before(async () => {
            await User.deleteMany({});

            // create the user that will already exist
            await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'signintest',
                    password: '123potatoes',
                    email: 'potatoes94@potatoes.com',
                });
        });

        after(async () => {
            await User.deleteMany({});
        });

        it('should give the user a token (log them in)', async () => {
            const res = await request(app)
                .post('/api/auth/signin')
                .send({
                    password: '123potatoes',
                    email: 'potatoes94@potatoes.com',
                });

            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('username', 'signintest');
            expect(res.body).to.have.property('id');
            expect(res.body).to.have.property('token');
        });

        it('should say "Invalid Email/Password" (bad username)', async () => {
            const res = await request(app)
                .post('/api/auth/signin')
                .send({
                    password: '123potatoes',
                    email: 'potatoes95@potatoes.com',
                });

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Invalid Email/Password');
        });

        it('should say "Invalid Email/Password" (bad password)', async () => {
            const res = await request(app)
                .post('/api/auth/signin')
                .send({
                    password: '123potatoes2',
                    email: 'potatoes94@potatoes.com',
                });

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Invalid Email/Password');
        });
    });
});
