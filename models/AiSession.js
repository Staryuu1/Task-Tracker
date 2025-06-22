const mongoose = require('mongoose');
const AiSessionSchema = new mongoose.Schema({
    phoneNumber: String,
    messages: [
        {
            role: { type: String, enum: ['user', 'assistant', 'system'] },
            content: String
        }
    ],
    createdAt: { type: Date, default: Date.now, expires: '10m' } 
});
module.exports = mongoose.model('AiSession', AiSessionSchema);
