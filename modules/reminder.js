require('dotenv').config();
const fs = require("fs");
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cron = require('node-cron');
const mongoose = require('mongoose');
const Task = require('../models/Task'); // Sesuaikan dengan model Task
const Profile = require("../models/Profile");
const path = require("path");

// Inisialisasi WhatsApp Client dengan session yang tersimpan
const client = new Client({
    authStrategy: new LocalAuth()
});

// Tampilkan QR Code untuk login pertama kali
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

// Konfirmasi jika bot sudah siap digunakan
client.on('ready', () => {
    console.log('WhatsApp Bot siap digunakan!');
    const qrPath = path.join(__dirname, "public", "qr.png");

    // Hapus QR Code jika ada
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

// Koneksi ke MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Fungsi untuk mengirim pesan WhatsApp
const sendWhatsAppMessage = async (phoneNumber, message) => {
    try {
        
        let formattedNumber = phoneNumber.toString().replace(/\D/g, ""); 

        if (formattedNumber === "0") {
            console.log("Nomor telepon belum diatur, pesan tidak dikirim.");
            return;
        }
        if (formattedNumber.startsWith("0")) {
            formattedNumber = "62" + formattedNumber.slice(1); // Ganti "0" dengan "62"
        } else if (!formattedNumber.startsWith("62")) {
            throw new Error("Nomor tidak valid. Harus diawali dengan '0' atau '62'.");
        }
        formattedNumber += "@c.us"; // Format untuk WhatsApp Web

        await client.sendMessage(formattedNumber, message);
        console.log(`Pesan dikirim ke ${formattedNumber}`);
    } catch (error) {
        console.error(`Gagal mengirim pesan ke ${phoneNumber}:`, error);
    }
};

// Fungsi untuk mengecek tugas yang jatuh tempo besok
const checkAndSendReminders = async () => {
    console.log('🔍 Mengecek tugas yang jatuh tempo...');

    try {
        const now = new Date();
        const today = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        ));
        today.setHours(7, 0, 0, 0); // WIB (UTC+7)
    
        const reminderDays = [4, 3, 2, 1];
        for (const daysBefore of reminderDays) {
            const reminderDate = new Date(today);
            reminderDate.setDate(today.getDate() + daysBefore);
            reminderDate.setHours(7, 0, 0, 0); // WIB (UTC+7)
    
            const nextDay = new Date(reminderDate);
            nextDay.setDate(reminderDate.getDate() + 1);
            nextDay.setHours(7, 0, 0, 0); // WIB (UTC+7)
    
            console.log(`🔎 Mencari tugas antara ${reminderDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} - ${nextDay.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
    
            const tasks = await Task.find({
                dueDate: { $gte: reminderDate, $lt: nextDay },
                completed: false
            });
    
            console.log(`📋 Ditemukan ${tasks.length} tugas.`);
            
            // **Mengelompokkan tugas berdasarkan user**
            const tasksByUser = {};
    
            for (const task of tasks) {
                if (!tasksByUser[task.user]) {
                    tasksByUser[task.user] = [];
                }
                tasksByUser[task.user].push(task);
            }
    
            for (const [userId, userTasks] of Object.entries(tasksByUser)) {
                let profile = await Profile.findOne({ user: userId });
    
                if (profile && profile.phoneNumber && profile.phoneVerified) {
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

