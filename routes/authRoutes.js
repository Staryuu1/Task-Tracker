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

        
        const user = new User({ username, email, password: hashedPassword, role: 'user', plan: 'basic' });
        await user.save();

        res.render('register', {
            message: {
                title: 'Register Berhasil',
                text: 'Akun Anda Berhasil Di Daftar, Silakan Login.',
                icon: 'success'
            }
        });
        // res.redirect('/auth/login');
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


// router.post('/login', passport.authenticate('local', {
//     successRedirect: '/tasks',
//     failureRedirect: '/auth/login'
// }));

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.render('login', {
        message: {
          title: 'Login Gagal',
          text: info.message || 'Username atau password salah.',
          icon: 'error'
        }
      });
    }

    // Login sukses → lanjutkan proses login dan redirect
    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.redirect('/tasks');
    });
  })(req, res, next);
});

// POST /auth/update-password
router.post('/update-password', async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;

        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Password baru tidak cocok' });
        }

        const user = await User.findById(req.user._id);
        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({ error: 'Password lama salah' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ success: true, message: 'Password berhasil diperbarui' });
    } catch (err) {
        console.error('Update password error:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});


module.exports = router;
