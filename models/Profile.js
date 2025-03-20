const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    name: { type: String, required: true },
    phoneNumber: { type: String, required: true, default: "0" }, 
});

module.exports = mongoose.model('Profiles', ProfileSchema);
