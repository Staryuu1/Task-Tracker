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
// app.js atau sebelum route
app.use((req, res, next) => {
  res.locals.isLoggedIn = req.isAuthenticated(); 
  res.locals.currentUser = req.user || null;     
  res.locals.isAdmin = req.user && req.user.role === 'admin';
  res.locals.currentPath = req.path
  next();
});

app.use('/auth', require('./routes/authRoutes'));
app.use('/tasks', require('./routes/taskRoutes'));
app.use('/profile', require('./routes/profileRoutes'));
app.use('/teams', require('./routes/teamRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

app.get('/', (req, res) => {
  res.render('landing');
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
});

client.initialize();
checkAndSendEmailReminders()
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));