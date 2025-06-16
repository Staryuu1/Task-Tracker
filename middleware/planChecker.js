const User = require('../models/User');

module.exports = async (req, res, next) => {
  if (
    req.isAuthenticated() &&
    req.user.plan === 'pro' &&
    req.user.planExpired &&
    req.user.planExpired < new Date()
  ) {
    await User.findByIdAndUpdate(req.user._id, {
      plan: 'basic',
      planExpired: null,
      upgradeDate: null,
    });

    req.user.plan = 'basic';
    req.user.planExpired = null;
    req.user.upgradeDate = null;
  }
  next();
};
