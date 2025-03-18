const express = require("express");
const Task = require("../models/Task");
const Notes = require("../models/Notes");
const { ensureAuthenticated } = require("../middleware/authMiddleware");
const router = express.Router();

// ✅ Route: Tampilkan semua task berdasarkan user yang login
router.get("/", ensureAuthenticated, async (req, res) => {
    try {
        const tasks = await Task.find({ user: req.user.id });
        const notes = await Notes.find({ user: req.user.id });
        res.render("Dashboard", { tasks, notes });
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


// ✅ Route: Tambah Task Baru
router.post("/add", ensureAuthenticated, async (req, res) => {
    try {
        const { title, description, dueDate, priority, category } = req.body;
        
        // Validate all fields
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
            completed: false, // Default false
        });

        await newTask.save();
        res.status(200).json({ message: "Task added successfully", task: newTask });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error adding task" });
    }
});

// ✅ Route: Toggle Complete Task
router.post("/complete/:id", ensureAuthenticated, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).send("Task not found");

        task.completed = !task.completed; // Toggle status
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
module.exports = router;
