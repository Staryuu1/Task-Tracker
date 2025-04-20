require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const fs = require("fs");
const path = require("path");
const passport = require('passport');
const methodOverride = require('method-override');
const {client} = require('./modules/reminder');
const {checkAndSendEmailReminders} = require('./modules/mailer');
require('./config/passport')(passport);

const app = express();


connectDB();


app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 
app.use(express.static('public')); 
app.use(methodOverride('_method')); 
app.set('view engine', 'ejs'); 


app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
        cookie: { maxAge: 24 * 60 * 60 * 1000 }, 
    })
);

app.use(passport.initialize());
app.use(passport.session());


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

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { message: 'Something went wrong!' });
});

client.initialize();
checkAndSendEmailReminders()
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));