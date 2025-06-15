const express = require("express");
const User = require("../models/User");
const Task = require("../models/Task");
const Team = require("../models/Team");
const os = require('os');
const router = express.Router();

// Middleware: Batasi hanya untuk admin (contoh, sesuaikan dengan field role di User)
function ensureAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).send("Forbidden: Admins only");
}


router.get("/dashboard", ensureAdmin, async (req, res) => {
  try {
    const [userCount, taskCount, teamCount] = await Promise.all([
      User.countDocuments(),
      Task.countDocuments(),
      Team.countDocuments()
    ]);

    const completedTaskCount = await Task.countDocuments({ completed: true });
    const pendingTaskCount = await Task.countDocuments({ completed: false });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: oneWeekAgo } });

    const overdueTasks = await Task.find({
      dueDate: { $lt: new Date() },
      completed: false
    }).limit(5).populate('user');

    const latestTasks = await Task.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user");

    res.render("admin/adminDashboard", {
      userCount,
      taskCount,
      teamCount,
      completedTaskCount,
      pendingTaskCount,
      newUsersThisWeek,
      overdueTasks,
      latestTasks
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});



router.get("/users", ensureAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "_id username email role plan");
    const message = req.session.message;
    delete req.session.message;
    res.render("admin/adminUsers", { users, message });
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
});


router.post("/users/:id/role", ensureAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).send("Invalid role");
    await User.findByIdAndUpdate(req.params.id, { role });
    req.session.message = { title: 'Berhasil', text: 'Role user berhasil diubah.', icon: 'success' };
    res.redirect("/admin/users");
  } catch (err) {
    req.session.message = { title: 'Gagal', text: 'Gagal mengubah role user.', icon: 'error' };
    res.redirect("/admin/users");
  }
});


router.post("/users/:id/plan", ensureAdmin, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['basic', 'pro'].includes(plan)) return res.status(400).send("Invalid plan");
    await User.findByIdAndUpdate(req.params.id, { plan });
    req.session.message = { title: 'Berhasil', text: 'Plan user berhasil diubah.', icon: 'success' };
    res.redirect("/admin/users");
  } catch (err) {
    req.session.message = { title: 'Gagal', text: 'Gagal mengubah plan user.', icon: 'error' };
    res.redirect("/admin/users");
  }
});


router.post("/users/:id/delete", ensureAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    req.session.message = { title: 'Berhasil', text: 'User berhasil dihapus.', icon: 'success' };
    res.redirect("/admin/users");
  } catch (err) {
    req.session.message = { title: 'Gagal', text: 'Gagal menghapus user.', icon: 'error' };
    res.redirect("/admin/users");
  }
});





module.exports = router;
