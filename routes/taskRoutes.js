const express = require('express');
const Task = require('../models/Task');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', ensureAuthenticated, async (req, res) => {
    const tasks = await Task.find({ user: req.user.id });
    res.render('dashboard', { tasks });
});

router.post('/add', ensureAuthenticated, async (req, res) => {
    await new Task({
        user: req.user.id,
        title: req.body.title,
        dueDate: req.body.dueDate,
        priority: req.body.priority
    }).save();
    res.redirect('/tasks');
});

router.post("/complete/:id", async (req, res) => {
    try {
        await Task.findByIdAndUpdate(req.params.id, { completed: true });
        res.redirect("/tasks"); // Sesuaikan dengan halaman dashboard
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});
router.post('/delete/:id', ensureAuthenticated, async (req, res) => {
    await Task.findByIdAndDelete(req.params.id);
    res.redirect('/tasks');
});

module.exports = router;
