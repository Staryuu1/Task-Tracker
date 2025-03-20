require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const fs = require("fs");
const path = require("path");
const passport = require('passport');
const methodOverride = require('method-override');
require('./modules/reminder');
require('./config/passport')(passport);

const app = express();

// Connect to the database
connectDB();

// Middleware
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.json()); // Parse JSON request bodies
app.use(express.static('public')); // Serve static files
app.use(methodOverride('_method')); // For PUT and DELETE methods
app.set('view engine', 'ejs'); // Set EJS as the view engine

// Session configuration
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
        cookie: { maxAge: 24 * 60 * 60 * 1000 }, // Session expires in 1 day
    })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', require('./routes/authRoutes'));
app.use('/tasks', require('./routes/taskRoutes'));
app.use('/profile', require('./routes/profileRoutes'));


app.get('/', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/login');
    res.redirect('/tasks');
});
app.get('/qrcode', (req, res) => {
    const filePath = path.join(__dirname, 'modules', 'public', 'qr.png');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('QR code not found');
    }
});
// Global error-handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { message: 'Something went wrong!' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));