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
    try {
        const { username, email, password, password2 } = req.body;

        if (password !== password2) {
            return res.render('register', {
                message: {
                    title: 'Gagal Register',
                    text: 'Password tidak sama.',
                    icon: 'error'
                }
            });
        }

       
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.render('register', {
                message: {
                    title: 'Gagal Register',
                    text: 'Username atau email sudah digunakan.',
                    icon: 'error'
                }
            });
        }

        
        const hashedPassword = await bcrypt.hash(password, 10);

        
        const user = new User({ username, email, password: hashedPassword });
        await user.save();

     
        res.redirect('/auth/login');
    } catch (err) {
        console.error('Error saat register:', err);
        res.render('register', {
            message: {
                title: 'Gagal Register',
                text: 'Terjadi kesalahan saat mendaftar.',
                icon: 'error'
            }
        });
    }
});


router.post('/login', passport.authenticate('local', {
    successRedirect: '/tasks',
    failureRedirect: '/auth/login'
}));

module.exports = router;
