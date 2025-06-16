const express = require("express");
const User = require('../models/User');
const Task = require('../models/Task');
const Notes = require('../models/Notes');
const Profile = require('../models/Profile');
const Team = require('../models/Team');
const { ensureAuthenticated } = require("../middleware/authMiddleware");
const {sendWhatsAppMessage} = require('../modules/reminder');
const {sendEmailReminder} = require('../modules/mailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
require('dotenv').config();


router.get("/", ensureAuthenticated, async (req, res) => {
    try {
        let profile = await Profile.findOne({ user: req.user._id });
      
        if (!profile) {
            profile = new Profile({
                user: req.user._id,
                name: req.user.username,
                phoneNumber: "0",
                phoneVerified:false,
                emailVerified: false,
                whatsappNotif: false
            });

            await profile.save();
        }
       
        res.render("Profile", { user: req.user, profile: profile });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});
router.get("/verify-phone/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const profile = await Profile.findOne({ user: decoded.userId });
        
        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }
        
        profile.phoneVerified = true;
        await profile.save();
        
        
        res.render('verification-success');
    } catch (err) {
        console.log(err)
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get("/get/:id", ensureAuthenticated, async (req, res) => {
   

    try {
        const profile = await Profile.findOne({ _id: req.params.id, user: req.user.id });

        if (!profile) {
            console.log("Profile not found:", req.params.id);
            return res.status(404).json({ error: "profile not found" });
        }

       
        res.status(200).json(profile);
    } catch (err) {
        console.error("Error fetching Profile:", err);
        res.status(500).json({ error: "Profile fetching profile" });
    }
});

router.post("/edit-phone/:id", ensureAuthenticated, async (req, res) => {


    try {
        const { Number } = req.body;

        if (!Number ) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const profile = await Profile.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { phoneNumber: Number, phoneVerified: false },
            { new: true }
        );

        if (!profile) {
            return res.status(404).json({ error: "Profile not found" });
        }
        const baseUrl = `${process.env.BASE_URL}/profile/verify-phone/`;
        const token = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const message = `👋 Hey ${req.user.username}!\n\nKamu hampir selesai! Klik link di bawah ini untuk verifikasi akun kamu:\n\n🔗 ${baseUrl}${token}\n\nKalau ini bukan kamu, cukup abaikan pesan ini. 😉`;


        await sendWhatsAppMessage(Number, message);
        res.status(200).json({ message: "Phone Number updated successfully", profile });
    } catch (err) {
        console.error("Server error:", err);
        console.log(err)
        res.status(500).json({ error: "Error updating Phone Number" });
    }
});

router.post("/edit-name/:id", ensureAuthenticated, async (req, res) => {


    try {
        const { Name } = req.body;

        if (!Number ) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const profile = await Profile.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { name: Name},
            { new: true }
        );

        if (!profile) {
            return res.status(404).json({ error: "Profile not found" });
        }
        
        res.status(200).json({ message: "Name updated successfully", profile });
    } catch (err) {
        console.error("Server error:", err);
        console.log(err)
        res.status(500).json({ error: "Error updating Name" });
    }
});

router.post("/edit-email/:id", ensureAuthenticated, async (req, res) => {
    try {
        const { Email } = req.body;
        if (!Email) {
            return res.status(400).json({ error: "Email is required" });
        }

       
        const user = await User.findOneAndUpdate(
            { _id: req.params.id, _id: req.user._id },
            { email: Email },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const baseUrl = `${process.env.BASE_URL}/profile/verify-email/`;
        const token = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const message = `👋 Hey ${req.user.username}!\n\nKamu hampir selesai! Klik link di bawah ini untuk verifikasi akun kamu:\n\n🔗 ${baseUrl}${token}\n\nKalau ini bukan kamu, cukup abaikan pesan ini. 😉`;
        let htmlContent = `</ul><p>🚀 Please complete these tasks on time!</p>`;
        
        sendEmailReminder(user.email, "Email Verifications", message);
        res.status(200).json({ message: "Email updated successfully", user });
    } catch (err) {
        console.error("Server error:", err);
        res.status(500).json({ error: "Error updating email" });
    }
});
router.get("/verify-email/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const profile = await Profile.findOne({ user: decoded.userId });
        
        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }
        
        profile.emailVerified = true;
        await profile.save();
        
        
        res.render('verification-success');
    } catch (err) {
        console.log(err)
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Notification Setting (WhatsApp only for Pro)
router.post('/notification-setting', ensureAuthenticated, async (req, res) => {
  if (req.user.plan !== 'pro' && req.body.whatsappNotif) {
    return res.status(400).json({ error: 'WhatsApp notif hanya untuk akun Pro.' });
  }
  
  await Profile.findOneAndUpdate({ user: req.user._id },{ whatsappNotif: !!req.body.whatsappNotif }
);
  res.status(200).json({ message: "Berhasil" });
});

// Delete Account
router.post('/delete-account', ensureAuthenticated, async (req, res, next) => {
  const userId = req.user._id;

  try {
    await Promise.all([
      User.findByIdAndDelete(userId),
      Task.deleteMany({ user: userId }),
      Notes.deleteMany({ user: userId }),
      Profile.deleteMany({ user: userId }),
      Team.updateMany({ members: userId }, { $pull: { members: userId } }),
      Team.deleteMany({ leader: userId })
    ]);

    req.logout(err => {
        if (err) return next(err);
        res.render('login', {
            message: {
            title: 'Akun dihapus',
            text: 'Akun Anda berhasil dihapus.',
            icon: 'success'
            }
        });
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).send('Terjadi kesalahan saat menghapus akun.');
  }
});


module.exports = router;
