const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Pastikan setiap task terkait dengan pengguna
    title: { type: String, required: true },
    description:{ type: String, required: true},
    dueDate: { type: Date, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], required: true },
    category: { type: String, enum: ['Task', 'Personal', 'Work'],required: true},
    completed: { type: Boolean, default: false } // Status tugas
});

module.exports = mongoose.model('Task', TaskSchema);
