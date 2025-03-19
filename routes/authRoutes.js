const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

router.get('/login', (req, res) => res.render('login'));
router.get('/register', (req, res) => res.render('register'));
router.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/auth/login'));
});

router.post('/register', async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await new User({ username: req.body.username, email: req.body.email, password: hashedPassword }).save();
    res.redirect('/auth/login');
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/tasks',
    failureRedirect: '/auth/login'
}));

module.exports = router;
