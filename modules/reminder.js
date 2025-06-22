require('dotenv').config();
const fs = require("fs");
const { Client, LocalAuth } = require('whatsapp-web.js');
const {openRouterCall} = require('./aiHandler');

const qrcode = require('qrcode');
const cron = require('node-cron');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Team = require('../models/Team');
const Profile = require("../models/Profile");
const path = require("path");
const AiSession = require('../models/AiSession');


const client = new Client({
    authStrategy: new LocalAuth()
});


client.on("qr", async (qr) => {
    console.log("QR Code baru dibuat, menyimpannya sebagai gambar...");
    
    const publicDir = path.join(__dirname, "public");
    const qrPath = path.join(publicDir, "qr.png");

   
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
        console.log('Folder "public" dibuat.');
    }

    
    try {
        await qrcode.toFile(qrPath, qr);
        console.log(`QR Code disimpan, akses di: /public/qr.png`);
    } catch (error) {
        console.error("Gagal menyimpan QR Code:", error);
    }

    console.log("QR Code disimpan, akses di: /public/qr.png");
});


client.on('ready', () => {
    console.log('WhatsApp Bot siap digunakan!');
    const qrPath = path.join(__dirname, "public", "qr.png");

    if (fs.existsSync(qrPath)) {
        fs.unlink(qrPath, (err) => {
            if (err) {
                console.error("Gagal menghapus QR Code:", err);
            } else {
                console.log("QR Code dihapus setelah bot siap.");
            }
        });
    }
    
    checkAndSendReminders();
});


mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB Connection Error:', err));


function normalizePhone(phoneNumber) {
    if (phoneNumber.startsWith('62')) {
        return '0' + phoneNumber.slice(2);
    }
    return phoneNumber;
}

client.on('message', async (msg) => {
    const text = msg.body.toLowerCase();
    const from = msg.from; 
    const phoneNumber = from.replace('@c.us', '');
    let session = await AiSession.findOne({ phoneNumber: normalizePhone(phoneNumber) });

    console.log(`Pesan diterima dari ${phoneNumber}: ${text}`);
    // if (!text.includes("tugas") && !session) return;


    const result = await openRouterCall(text, phoneNumber);
   
    if (result.error) {
        return msg.reply(result.error);
    }

    if (result.action === "request_detail") {
        return await sendWhatsAppMessage(phoneNumber, `🤖 ${result.message}`);
    }

    if (result.action === "add_task") {
        try {
            const userNumber = normalizePhone(phoneNumber);
            const profile = await Profile.findOne({ phoneNumber: userNumber });
            if (!profile) return msg.reply("❌ Profil tidak ditemukan.");

            const newTask = new Task({
                user: profile.user,
                title: result.title,
                description: result.description,
                dueDate: new Date(result.dueDate),
                priority: result.priority,
                category: result.category
            });

            await newTask.save();

            await sendWhatsAppMessage(phoneNumber,
                `${result.message || "✅ Tugas berhasil ditambahkan:"}\n` +
                `📌 *${result.title}*\n` +
                `📝 ${result.description}\n` +
                `📅 Deadline: ${new Date(result.dueDate).toLocaleDateString('id-ID')}\n` +
                `🔺 Prioritas: ${result.priority}\n` +
                `📂 Kategori: ${result.category}`
            );
        } catch (err) {
            console.error("❌ Gagal menambahkan tugas:", err);
            msg.reply("⚠️ Gagal menambahkan tugas.");
        }

    } else if (result.action === "list_tasks") {
        const userNumber = normalizePhone(phoneNumber);
        const profile = await Profile.findOne({ phoneNumber: userNumber });
        if (!profile) return msg.reply("❌ Profil tidak ditemukan.");

        let session = await AiSession.findOne({ phoneNumber: userNumber });

        const tasks = await Task.find({ user: profile.user, completed: false }).sort({ dueDate: 1 });
        if (tasks.length === 0) {
            return msg.reply("📭 Kamu tidak punya tugas yang belum selesai.");
        }

        let taskMsg = `${ "📋 *Daftar Tugas Aktif*"} \n\n`;
        tasks.forEach((t, i) => {
            taskMsg += `*${i + 1}. ${t.title}*\n📅 ${t.dueDate.toLocaleDateString('id-ID')}\n📂 ${t.category}\n\n`;
        });

        if (!session) {
            session = new AiSession({
                phoneNumber: userNumber,
                messages: []
            });
        }

        session.messages.push({ role: 'assistant', content: taskMsg });
        await session.save();

        await sendWhatsAppMessage(phoneNumber, taskMsg);

    } else if (result.action === "complete_task") {
       try {
        const userNumber = normalizePhone(phoneNumber);
        const profile = await Profile.findOne({ phoneNumber: userNumber });
        if (!profile) return msg.reply("❌ Profil tidak ditemukan."); 

        // Pastikan title bisa array atau string
        const titles = Array.isArray(result.title) ? result.title : [result.title];
        const completedTitles = [];
        const failedTitles = [];

        for (const title of titles) {
            const task = await Task.findOne({ 
                user: profile.user, 
                title: new RegExp(`^${title}$`, 'i') 
            });

            if (task) {
                task.completed = !task.completed;
                await task.save();
                completedTitles.push(`✅ "${task.title}" → ${task.completed ? "selesai" : "belum selesai"}`);
            } else {
                failedTitles.push(`❌ "${title}" tidak ditemukan`);
            }
        }

        // Gabungkan pesan hasil
        let finalMessage = completedTitles.concat(failedTitles).join('\n');
        await sendWhatsAppMessage(phoneNumber, finalMessage);

        } catch (err) {
            console.error("❌ Gagal menyelesaikan tugas:", err);
            msg.reply("⚠️ Gagal menyelesaikan tugas.");
        }
    } else {
        msg.reply("🤖 Perintah tidak dikenali.");
    }
});


const sendWhatsAppMessage = async (phoneNumber, message) => {
    try {
        
        let formattedNumber = phoneNumber.toString().replace(/\D/g, ""); 

        if (formattedNumber === "0") {
            console.log("Nomor telepon belum diatur, pesan tidak dikirim.");
            return;
        }
        if (formattedNumber.startsWith("0")) {
            formattedNumber = "62" + formattedNumber.slice(1); 
        } else if (!formattedNumber.startsWith("62")) {
            throw new Error("Nomor tidak valid. Harus diawali dengan '0' atau '62'.");
        }
        formattedNumber += "@c.us"; 

        await client.sendMessage(formattedNumber, message);
        console.log(`Pesan dikirim ke ${formattedNumber}`);
    } catch (error) {
        console.error(`Gagal mengirim pesan ke ${phoneNumber}:`, error);
    }
};



const checkAndSendReminders = async () => {
    console.log('🔍 Mengecek tugas yang jatuh tempo...');

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

            console.log(`🔎 Mencari tugas antara ${reminderDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} - ${nextDay.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);

            const tasks = await Task.find({
                dueDate: { $gte: reminderDate, $lt: nextDay },
                completed: false
            });

            console.log(`📋 Ditemukan ${tasks.length} tugas.`);

            const tasksByUser = {};

            for (const task of tasks) {
                if (!tasksByUser[task.user]) {
                    tasksByUser[task.user] = [];
                }
                tasksByUser[task.user].push(task);
            }

            for (const [userId, userTasks] of Object.entries(tasksByUser)) {
                const profile = await Profile.findOne({ user: userId });

                if (profile && profile.phoneNumber && profile.phoneVerified && profile.whatsappNotif) {
                    let message = `🔔 *Pengingat: Kamu memiliki ${userTasks.length} tugas dengan deadline dalam ${daysBefore} hari!* 🔔\n\n`;

                    userTasks.forEach((task, index) => {
                        message += `📌 *${index + 1}. ${task.title}*\n📅 *Deadline:* ${task.dueDate.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}\n📝 *Deskripsi:* ${task.description}\n\n`;
                    });

                    message += `🚀 Segera selesaikan tugas-tugas ini agar tidak terlambat! ✅`;

                    await sendWhatsAppMessage(profile.phoneNumber, message);
                    console.log(`📨 Mengirim pesan ke ${profile.phoneNumber} (${userTasks.length} tugas)`);
                } else {
                    console.log(`⚠️ User ${userId} tidak memiliki nomor telepon terverifikasi.`);
                }

               
                for (const task of userTasks) {
                    console.log(task.category);
                    if (task.category?.toLowerCase() === 'team') {
                        const teams = await Team.find({ tasks: task._id }).populate('members');
                        console.log(`👥 Ditemukan ${teams.length} tim untuk tugas ini.`);
                        
                        for (const team of teams) {
                            for (const member of team.members) {
                                if (String(member._id) === String(userId)) continue; 
                                
                                const memberProfile = await Profile.findOne({ user: member._id });

                                if (memberProfile && memberProfile.phoneNumber && memberProfile.phoneVerified && memberProfile.whatsappNotif) {
                                    let msg = `👥 *Pengingat Tugas Tim:*\n\n📌 *${task.title}*\n📅 *Deadline:* ${task.dueDate.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}\n📝 *Deskripsi:* ${task.description}\n\n🚀 Harap bantu menyelesaikan tugas ini tepat waktu.`;

                                    await sendWhatsAppMessage(memberProfile.phoneNumber, msg);
                                    console.log(`📨 Reminder dikirim ke anggota tim (${memberProfile.phoneNumber})`);
                                } else {
                                    console.log(`⚠️ Anggota tim ${member._id} tidak memiliki profil yang valid atau WhatsApp dinonaktifkan.`);
                                }
                            }
                        }
                    }

                }
            }

            console.log(`✅ Pengingat selesai dikirim untuk tugas yang deadline dalam ${daysBefore} hari.`);
        }
    } catch (error) {
        console.error('❌ Gagal mengecek tugas:', error);
    }
};



cron.schedule('0 6 * * *', async () => {

    await checkAndSendReminders();
}, {
    scheduled: true,
    timezone: "Asia/Jakarta" 
});


module.exports = { client, sendWhatsAppMessage };

