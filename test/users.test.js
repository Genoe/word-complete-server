/* eslint-env mocha */
require('dotenv').config();

process.env.DB_URL = 'mongodb://localhost/word-complete-test';
process.env.PORT = 9090;

// test key from: https://developers.google.com/recaptcha/docs/faq
process.env.RECAPTCHA_SECRET = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

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
                    passwordConfirm: 'morepotatoes',
                    email: 'potatoes@potatoes.com',
                    captchaToken: 'test',
                });

            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('username', 'potatoes');
            expect(res.body).to.have.property('id');
            expect(res.body).to.have.property('token');
        });

        it('Should prompt for a longer password', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'potatoes',
                    password: '1234567',
                    passwordConfirm: '1234567',
                    email: 'potatoes@potatoes.com',
                    captchaToken: 'test',
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
                    passwordConfirm: '12345678',
                    email: 'potatoes@potatoes.com',
                    captchaToken: 'test',
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
                    passwordConfirm: '12345678',
                    email: 'potatoes@potatoes',
                    captchaToken: 'test',
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
                    passwordConfirm: '',
                    email: 'potatoes@potatoes',
                    captchaToken: 'test',
                });

            expect(res.status).to.equal(422);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(3).that
                .includes('Please Enter a Valid Email Address')
                .and.includes('Username Must Be Between 5 and 20 Characters')
                .and.includes('Password Must Be At Least 8 Characters Long');
        });

        it('Should promt for matching passwords (mismatch)', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'testing',
                    password: 'test12345',
                    passwordConfirm: 'test123456',
                    email: 'test@test.com',
                    captchaToken: 'test',
                });

            expect(res.status).to.equal(422);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Passwords do not match');
        });

        it('Should promt for matching passwords (skipped confirmation)', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'testing',
                    password: 'test12345',
                    passwordConfirm: '',
                    email: 'test@test.com',
                    captchaToken: 'test',
                });

            expect(res.status).to.equal(422);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Passwords do not match');
        });

        it('Should promt for longer password (skipped both password fields)', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'testing',
                    password: '',
                    passwordConfirm: '',
                    email: 'test@test.com',
                    captchaToken: 'test',
                });

            expect(res.status).to.equal(422);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Password Must Be At Least 8 Characters Long');
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
                    passwordConfirm: 'morepotatoes',
                    email: 'potatoes@potatoes.com',
                    captchaToken: 'test',
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
                    passwordConfirm: 'morepotatoes',
                    email: 'potatoes1@potatoes.com',
                    captchaToken: 'test',
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
                    passwordConfirm: '123potatoes',
                    email: 'potatoes94@potatoes.com',
                    captchaToken: 'test',
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
                    captchaToken: 'test',
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
                    captchaToken: 'test',
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
                    captchaToken: 'test',
                });

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Invalid Email/Password');
        });
    });
});

describe('api/users', () => {
    describe('POST api/users/id/account', () => {
        let token;
        let id;

        before(async () => {
            await User.deleteMany({});

            // create the user that gets updated
            const res = await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'testing',
                    password: 'potatoes',
                    passwordConfirm: 'potatoes',
                    email: 'potatoes@potatoes.com',
                    captchaToken: 'test',
                });

            token = res.body.token;
            id = res.body.id;

            // create an account that already uses a desired new username
            await request(app)
                .post('/api/auth/signup')
                .send({
                    username: 'taken',
                    password: 'potatoes',
                    passwordConfirm: 'potatoes',
                    email: 'taken@potatoes.com',
                    captchaToken: 'test',
                });
        });

        after(async () => {
            await User.deleteMany({});
        });

        it('Should update the username', async () => {
            console.log(token, id);
            const res = await request(app)
                .put(`/api/users/${id}/account`)
                .send({
                    username: 'new username',
                })
                .set({
                    Authorization: `Bearer ${token}`,
                });

            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('id');
            expect(res.body).to.have.property('username', 'new username');
            expect(res.body).to.have.property('token');
        });

        it('Should say the username is too long/short (long)', async () => {
            const res = await request(app)
                .put(`/api/users/${id}/account`)
                .send({
                    username: 'new username this username is too long',
                })
                .set({
                    Authorization: `Bearer ${token}`,
                });

            expect(res.status).to.equal(422);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Username Must Be Between 5 and 20 Characters');
        });

        it('Should say the username is too long/short (short)', async () => {
            const res = await request(app)
                .put(`/api/users/${id}/account`)
                .send({
                    username: '',
                })
                .set({
                    Authorization: `Bearer ${token}`,
                });

            expect(res.status).to.equal(422);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Username Must Be Between 5 and 20 Characters');
        });

        it('Should say the username already exists', async () => {
            const res = await request(app)
                .put(`/api/users/${id}/account`)
                .send({
                    username: 'taken',
                })
                .set({
                    Authorization: `Bearer ${token}`,
                });

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Sorry, that username is taken');
        });

        it('Should say to log in (bad token)', async () => {
            const res = await request(app)
                .put(`/api/users/${id}/account`)
                .send({
                    username: 'taken',
                })
                .set({
                    Authorization: `Bearer ${token}bad`, // add nonsense to the token
                });

            expect(res.status).to.equal(401);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Please log in first');
        });

        it('Should say to log in (no token)', async () => {
            const res = await request(app)
                .put(`/api/users/${id}/account`)
                .send({
                    username: 'taken',
                });

            expect(res.status).to.equal(401);
            expect(res.body).to.have.property('error');
            expect(res.body.error).to.have.property('message');
            expect(res.body.error.message).to.be.an('array').of.length(1).that
                .includes('Please log in first');
        });
    });
});
