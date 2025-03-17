require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const methodOverride = require('method-override');

require('./config/passport')(passport);

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

// Session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', require('./routes/authRoutes'));
app.use('/tasks', require('./routes/taskRoutes'));
connectDB();
// Home
app.get('/', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/login');
    res.redirect('/tasks');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
