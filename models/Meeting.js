const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    title: { type: String, required: true },
    description:{ type: String, required: true},
    Date: { type: Date, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], required: true },
    
});

module.exports = mongoose.model('Meeting', TaskSchema);
