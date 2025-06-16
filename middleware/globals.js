module.exports = (req, res, next) => {
  res.locals.isLoggedIn = req.isAuthenticated();
  res.locals.currentUser = req.user || null;
  res.locals.isAdmin = req.user && req.user.role === 'admin';
  res.locals.currentPath = req.path;
  next();
};
