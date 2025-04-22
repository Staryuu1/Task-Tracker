require('dotenv').config();
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');

const Profile = require('../models/Profile');  // Adjust the path as needed



const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true', 
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});


transporter.verify(function(error, success) {
    if (error) {
        console.error('Error connecting to SMTP server:', error);
    } else {
        console.log('SMTP server is ready to take messages');
    }
});

const sendEmailReminder = async (email, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: `"Task Manager" <${process.env.SMTP_USER}>`,
            to: email,
            subject: subject,
            html: htmlContent,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
    }
};

const checkAndSendEmailReminders = async () => {
    console.log('🔍 Checking tasks due for email reminders...');

    try {
        const now = new Date();
        const today = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        ));
        today.setHours(0, 0, 0, 0);

        const reminderDays = [4, 3, 2, 1];
        for (const daysBefore of reminderDays) {
            const reminderDate = new Date(today);
            reminderDate.setDate(today.getDate() + daysBefore);
            reminderDate.setHours(0, 0, 0, 0);

            const nextDay = new Date(reminderDate);
            nextDay.setDate(reminderDate.getDate() + 1);
            nextDay.setHours(0, 0, 0, 0);

            console.log(`🔎 Searching tasks between ${reminderDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} - ${nextDay.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);

            const tasks = await Task.find({
                dueDate: { $gte: reminderDate, $lt: nextDay },
                completed: false
            });

            console.log(`📋 Found ${tasks.length} tasks.`);

            const tasksByUser = {};

            for (const task of tasks) {
                if (!tasksByUser[task.user]) {
                    tasksByUser[task.user] = [];
                }
                tasksByUser[task.user].push(task);
            }

            for (const [userId, userTasks] of Object.entries(tasksByUser)) {
                let user = await User.findById(userId);
                let profile = await Profile.findOne({ user: userId });

                if (user && user.email && profile.emailVerified) {
                    let htmlContent = `<h3>🔔 Reminder: You have ${userTasks.length} task(s) due in ${daysBefore} day(s)!</h3><ul>`;

                    userTasks.forEach((task) => {
                        htmlContent += `<li><strong>${task.title}</strong><br/>Due Date: ${task.dueDate.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}<br/>Description: ${task.description || '-'}</li><br/>`;
                    });

                    htmlContent += `</ul><p>🚀 Please complete these tasks on time!</p>`;

                    await sendEmailReminder(user.email, `Task Reminder: ${userTasks.length} task(s) due in ${daysBefore} day(s)`, htmlContent);
                    console.log(`📨 Email reminder sent to ${user.email} (${userTasks.length} tasks)`);
                } else {
                    console.log(`⚠️ User ${userId} does not have a valid email.`);
                }
            }

            console.log(`✅ Email reminders sent for tasks due in ${daysBefore} day(s).`);
        }
    } catch (error) {
        console.error('❌ Failed to check/send email reminders:', error);
    }
};


cron.schedule('0 6 * * *', async () => {
    await checkAndSendEmailReminders();
}, {
    scheduled: true,
    timezone: "Asia/Jakarta"
});

module.exports = {
    checkAndSendEmailReminders,
    sendEmailReminder,
};
