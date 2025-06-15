const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
    username: String,
    email: String,  
    password: String,
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    plan: { type: String, enum: ['basic', 'pro'], default: 'basic' },
}, { timestamps: true });
module.exports = mongoose.model('User', UserSchema);
