const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Pastikan setiap task terkait dengan pengguna
    name: { type: String, required: true },
    phoneNumber: { type: Number, required: true, default: 0 }, 
});

module.exports = mongoose.model('Profiles', ProfileSchema);
