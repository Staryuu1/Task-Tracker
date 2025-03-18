const mongoose = require('mongoose');

const NotesSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Pastikan setiap task terkait dengan pengguna
    title: { type: String, required: true },
    notes:{ type: String, required: true},
});

module.exports = mongoose.model('Notes', NotesSchema);
