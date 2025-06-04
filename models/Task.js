const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    title: { type: String, required: true },
    description:{ type: String, required: true},
    dueDate: { type: Date, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], required: true },
    category: { type: String, enum: ['Task', 'Personal', 'Work','Team','Meeting'],required: true},
    completed: { type: Boolean, default: false } // Status tugas
});

module.exports = mongoose.model('Task', TaskSchema);
