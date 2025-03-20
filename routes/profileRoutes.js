const express = require("express");
const User = require('../models/User');
const Profile = require("../models/Profile");
const { ensureAuthenticated } = require("../middleware/authMiddleware");
const router = express.Router();


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

module.exports = router;
