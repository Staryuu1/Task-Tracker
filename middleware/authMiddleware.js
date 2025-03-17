module.exports = {
    ensureAuthenticated: (req, res, next) => {
        return req.isAuthenticated() ? next() : res.redirect('/auth/login');
    }
};
