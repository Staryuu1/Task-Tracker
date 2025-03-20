require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const mongoose = require('mongoose');
const Task = require('../models/Task'); // Sesuaikan dengan model Task
const Profile = require("../models/Profile");
const User = require("../models/User");

// Inisialisasi WhatsApp Client dengan session yang tersimpan
const client = new Client({
    authStrategy: new LocalAuth()
});

// Tampilkan QR Code untuk login pertama kali
client.on('qr', qr => {
    console.log('Scan QR Code ini untuk login ke WhatsApp!');
    qrcode.generate(qr, { small: true });
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
        // Pastikan nomor diawali dengan kode negara dan tidak mengandung karakter tambahan
        let formattedNumber = phoneNumber.toString().replace(/\D/g, ""); // Hanya angka
        if (!formattedNumber.startsWith("62")) { // Jika bukan nomor Indonesia, tambahkan kode negara
            formattedNumber = "62" + formattedNumber.slice(1);
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
