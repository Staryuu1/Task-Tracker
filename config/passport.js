const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

module.exports = function(passport) {
    passport.use(new LocalStrategy(async (username, password, done) => {
        const user = await User.findOne({ username });
        if (!user) return done(null, false, { message: 'User not found' });
        const isMatch = await bcrypt.compare(password, user.password);
        return isMatch ? done(null, user) : done(null, false, { message: 'Wrong password' });
    }));

    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser(async (id, done) => {
        const user = await User.findById(id);
        done(null, user);
    });
};
