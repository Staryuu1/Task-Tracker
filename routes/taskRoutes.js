const express = require("express");
const Task = require("../models/Task");
const Team = require("../models/Team");
const Notes = require("../models/Notes");
const { ensureAuthenticated } = require("../middleware/authMiddleware");
const router = express.Router();


router.get("/", ensureAuthenticated, async (req, res) => {
    try {
        const userid = req.user.id
        const Personaltasks = await Task.find({ user: req.user.id });
        const notes = await Notes.find({ user: req.user.id });
        const Teams = await await Team.find({ members: req.user._id }).populate('tasks');
        const teamTasks = Teams.flatMap(team => team.tasks);
        const FindTaskID = await Task.find({_id: teamTasks})
        let tasks = [...Personaltasks, ...FindTaskID];
        tasks = tasks.filter((task, index, self) =>
            index === self.findIndex((t) => t._id.toString() === task._id.toString())
        );
        
        res.render("Dashboard", { tasks, notes,userid });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

//// Task Routes/////
router.get("/get/:id", ensureAuthenticated, async (req, res) => {
   

    try {
        const task = await Task.findOne({ _id: req.params.id, user: req.user.id });
       
        
        if (!task) {
            console.log("Task not found:", req.params.id);
            return res.status(404).json({ error: "Task not found" });
        }

       
        res.status(200).json(task);
    } catch (err) {
        console.error("Error fetching task:", err);
        res.status(500).json({ error: "Error fetching task" });
    }
});



router.post("/add", ensureAuthenticated, async (req, res) => {
    try {
        const { title, description, dueDate, priority, category } = req.body;
        
       
        if (!title || !description || !dueDate || !priority || !category) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const newTask = new Task({
            user: req.user.id,
            title,
            description,
            dueDate,
            priority,
            category,
            completed: false, 
        });

        await newTask.save();
        res.status(200).json({ message: "Task added successfully", task: newTask });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error adding task" });
    }
});


router.post("/complete/:id", ensureAuthenticated, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).send("Task not found");

        task.completed = !task.completed; 
        await task.save();
        res.redirect("/tasks");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating task");
    }
});

router.post("/edit/:id", ensureAuthenticated, async (req, res) => {


    try {
        const { title, description, dueDate, priority, category } = req.body;

        if (!title || !description || !dueDate || !priority || !category) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { title, description, dueDate, priority, category },
            { new: true }
        );

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        
        res.status(200).json({ message: "Task updated successfully", task });
    } catch (err) {
        console.error("Server error:", err);
        res.status(500).json({ error: "Error updating task" });
    }
});


router.post("/delete/:id", ensureAuthenticated, async (req, res) => {
   
    try {
        await Task.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        res.redirect("/tasks");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting task");
    }
});
///// End of Task Routes/////

//// Notes Routes////
router.post("/addnotes", ensureAuthenticated, async (req, res) => {
    try {
        const { title, notes } = req.body;
        // Validate all fields
        if (!title || !Notes ) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const newNotes = new Notes({
            user: req.user.id,
            title,
            notes,
        });

        await newNotes.save();
        res.status(200).json({ message: "Notes added successfully", note: newNotes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error adding task" });
    }
});
router.post("/deletenotes/:id", ensureAuthenticated, async (req, res) => {
   
    try {
        await Notes.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        res.redirect("/tasks");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting task");
    }
});


router.get("/tasks-in-month", ensureAuthenticated, async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const month = parseInt(req.query.month);

        if (isNaN(year) || isNaN(month)) {
            return res.status(400).json({ error: "Invalid year or month" });
        }

        const userId = req.user.id;

        // Awal dan akhir bulan
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        // Cari task user di rentang waktu tsb
        const personalTasks = await Task.find({
            user: userId,
            dueDate: { $gte: startDate, $lte: endDate }
        });

        // Cari task team
        const teams = await Team.find({ members: userId }).populate('tasks');
        const teamTasks = teams.flatMap(team => team.tasks).filter(task => {
            const due = new Date(task.dueDate);
            return due >= startDate && due <= endDate;
        });

        // Gabungkan + hilangkan duplikat
        const allTasks = [...personalTasks, ...teamTasks];
        const uniqueTasks = [];
        const seen = new Set();
        for (const task of allTasks) {
            const id = task._id.toString();
            if (!seen.has(id)) {
                uniqueTasks.push(task);
                seen.add(id);
            }
        }

        // Buat mapping tasksByDay: { tanggal: [ {priority, ...}, ... ] }
        const tasksByDay = {};
        uniqueTasks.forEach(task => {
            const day = new Date(task.dueDate).getDate();
            if (!tasksByDay[day]) tasksByDay[day] = [];
            tasksByDay[day].push({ priority: task.priority });
        });

        const uniqueTaskDays = Object.keys(tasksByDay).map(Number);

        res.json({ daysWithTasks: uniqueTaskDays, tasksByDay });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


router.get("/tasks-in-day", ensureAuthenticated, async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const month = parseInt(req.query.month); 
        const day = parseInt(req.query.day);
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            return res.status(400).json({ error: "Invalid year, month, or day" });
        }
        const userId = req.user.id;
        // Start and end of the day
        const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        // Personal tasks
        const personalTasks = await Task.find({
            user: userId,
            dueDate: { $gte: startDate, $lte: endDate }
        });
        // Team tasks
        const teams = await Team.find({ members: userId }).populate('tasks');
        const teamTasks = teams.flatMap(team => team.tasks).filter(task => {
            const due = new Date(task.dueDate);
            return due >= startDate && due <= endDate;
        });
        // Merge and deduplicate
        const allTasks = [...personalTasks, ...teamTasks];
        const uniqueTasks = [];
        const seen = new Set();
        for (const task of allTasks) {
            const id = task._id.toString();
            if (!seen.has(id)) {
                uniqueTasks.push(task);
                seen.add(id);
            }
        }
        res.json({ tasks: uniqueTasks });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
