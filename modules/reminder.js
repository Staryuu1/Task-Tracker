require('dotenv').config();
const fs = require("fs");
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cron = require('node-cron');
const mongoose = require('mongoose');
const Task = require('../models/Task'); // Sesuaikan dengan model Task
const Profile = require("../models/Profile");
const User = require("../models/User");
const path = require("path");

// Inisialisasi WhatsApp Client dengan session yang tersimpan
const client = new Client({
    authStrategy: new LocalAuth()
});

// Tampilkan QR Code untuk login pertama kali
client.on("qr", async (qr) => {
    console.log("QR Code baru dibuat, menyimpannya sebagai gambar...");
    
    const qrPath = path.join(__dirname, "public", "qr.png");
    await qrcode.toFile(qrPath, qr);

    console.log("QR Code disimpan, akses di: /public/qr.png");
});

// Konfirmasi jika bot sudah siap digunakan
client.on('ready', () => {
    console.log('WhatsApp Bot siap digunakan!');

    // Jalankan manual untuk testing (hapus ini setelah testing)
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
    console.log('🔍 Mengecek tugas yang jatuh tempo besok...');

    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const tasks = await Task.find({
            dueDate: { $gte: tomorrow, $lt: new Date(tomorrow.getTime() + 86400000) },
            completed: false
        });
        
        for (const task of tasks) {
            let profile = await Profile.findOne({ user: task.user });
        
            if (profile && profile.phoneNumber) {
                const message = `🔔 *Pengingat: Tugas Kamu Jatuh Tempo Besok!* 🔔\n\n📌 *${task.title}*\n📅 ${task.dueDate.toDateString()}\n📝 ${task.description}\n\nSegera selesaikan tugas ini! ✅`;
                await sendWhatsAppMessage(profile.phoneNumber, message);
            }
        }

        console.log(`📢 Pengingat dikirim untuk ${tasks.length} tugas.`);
    } catch (error) {
        console.error('❌ Gagal mengecek tugas:', error);
    }
};

// Cron job untuk mengirim pengingat setiap hari jam 08:00
cron.schedule('0 6 * * *', async () => {
    await checkAndSendReminders();
});

// Jalankan WhatsApp Client
client.initialize();
