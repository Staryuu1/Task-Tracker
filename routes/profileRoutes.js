const express = require("express");
const User = require('../models/User');
const Profile = require("../models/Profile");
const { ensureAuthenticated } = require("../middleware/authMiddleware");
const {sendWhatsAppMessage} =require('../modules/reminder');
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
        const profile =  await Profile.findOne({ user: token })
        
        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }
        
        profile.phoneVerified = true;
        await profile.save();
        
        res.json({ message: "Nomor telepon berhasil diverifikasi." });
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
        const baseUrl =  `${process.env.BASE_URL}/profile/verify-phone/`;
        const message = `👋 Hey ${req.user.username}!\n\nKamu hampir selesai! Klik link di bawah ini untuk verifikasi akun kamu:\n\n🔗 ${baseUrl}${req.user.id}\n\nKalau ini bukan kamu, cukup abaikan pesan ini. 😉`;


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
module.exports = router;
