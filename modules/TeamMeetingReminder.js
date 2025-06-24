const Task = require('../models/Task');
const Profile = require('../models/Profile');
const Team = require('../models/Team');
const { sendWhatsAppMessage } = require('./reminder');
const { sendEmailReminder } = require('./mailer');
const cron = require('node-cron');

const checkUpcomingMeetings = async () => {
    console.log('📆 Mengecek meeting yang akan dimulai dalam 30 menit...');

    try {
        const now = new Date(Date.now());
        const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
        console.log('now (UTC):', now);
        console.log('in 30 mins (UTC):', in30Minutes);
        
        const meetings = await Task.find({
            category: 'Meeting',
            dueDate: { $gte: now ,$lte: in30Minutes },
            completed: false,
            reminderSent: false

        }).populate('user');
        console.log(meetings)
        console.log(`📋 Ditemukan ${meetings.length} meeting.`);

        for (const task of meetings) {
            const notifiedUserIds = new Set();

            const messageText = buildMeetingMessage(task);
            const emailSubject = `📣 Meeting Reminder: ${task.title}`;
            const emailHTML = buildMeetingEmail(task);

            // 🔔 Kirim ke pemilik tugas
            if (task.user) {
                const profile = await Profile.findOne({ user: task.user._id });

                if (profile) {
                    // WhatsApp
                    if (profile.phoneNumber && profile.phoneVerified && profile.whatsappNotif) {
                        await sendWhatsAppMessage(profile.phoneNumber, messageText);
                        console.log(`📨 WA dikirim ke owner (${profile.phoneNumber})`);
                    }

                    // Email
                    if (task.user.email && profile.emailVerified) {
                        await sendEmailReminder(task.user.email, emailSubject, emailHTML);
                        console.log(`📧 Email dikirim ke owner (${task.user.email})`);
                    }

                    notifiedUserIds.add(String(task.user._id));
                }
            }

            // 🔁 Kirim ke anggota tim
            const teams = await Team.find({ tasks: task._id }).populate('members');

            for (const team of teams) {
                for (const member of team.members) {
                    if (notifiedUserIds.has(String(member._id))) continue;

                    const memberProfile = await Profile.findOne({ user: member._id });
                    const memberUser = member; 

                    if (memberProfile) {
                        // WhatsApp
                        if (memberProfile.phoneNumber && memberProfile.phoneVerified && memberProfile.whatsappNotif) {
                            await sendWhatsAppMessage(memberProfile.phoneNumber, messageText);
                            console.log(`📨 WA dikirim ke member tim (${memberProfile.phoneNumber})`);
                        }

                        if (memberUser.email && memberProfile.emailVerified) {
                            await sendEmailReminder(memberUser.email, emailSubject, emailHTML);
                            console.log(`📧 Email dikirim ke member tim (${memberUser.email})`);
                        }

                        notifiedUserIds.add(String(member._id));
                    }
                }
            }
            task.reminderSent = true;
            await task.save();
        }

        console.log('✅ Pengingat meeting selesai dikirim.');
    } catch (err) {
        console.error('❌ Gagal mengirim pengingat meeting:', err);
    }
};


const buildMeetingMessage = (task) => {
    return `📣 *Pengingat Meeting!*\n\n🗓️ *${task.title}*\n⏰ *Waktu:* ${task.dueDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n📝 *Deskripsi:* ${task.description || '-'}\n\n🚀 Jangan lupa untuk hadir tepat waktu!`;
};


const buildMeetingEmail = (task) => {
    return `
        <h2>📣 Pengingat Meeting!</h2>
        <p><strong>Judul:</strong> ${task.title}</p>
        <p><strong>Waktu:</strong> ${task.dueDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</clep>
        <p><strong>Deskripsi:</strong> ${task.description || '-'}</p>
        <p>🚀 Jangan lupa untuk hadir tepat waktu!</p>
    `;
};


const initializeMeetingCron = () => {
    console.log('✅ Cron meeting reminder diaktifkan, cek setiap 30 menit...');
    cron.schedule('*/10 * * * *', () => {
        console.log('🔁 Menjalankan cron: cek meeting...');
        checkUpcomingMeetings();
    });
};

module.exports = { initializeMeetingCron  };
