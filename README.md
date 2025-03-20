# Task Tracker

## 📌 Deskripsi
Task Tracker adalah aplikasi manajemen tugas berbasis web yang memungkinkan pengguna untuk menambahkan, menyelesaikan, dan menghapus tugas mereka. Aplikasi ini menggunakan **Node.js**, **Express**, **MongoDB**, serta **EJS** untuk tampilan dan **Tailwind CSS** untuk styling.

## 🚀 Fitur
- 🔐 **Autentikasi Pengguna** (Login, Register, Logout)
- ✅ **Menambahkan Tugas Baru**
- 📅 **Menentukan Tanggal Jatuh Tempo**
- 🚦 **Menentukan Prioritas Tugas** (Low, Medium, High)
- 🏆 **Menandai Tugas Sebagai Selesai**
- 🗑️ **Menghapus Tugas**
- 📊 **Progress Bar Menunjukkan Presentasi Tugas yang Selesai**

## 🛠️ Teknologi yang Digunakan
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **Frontend:** EJS, Tailwind CSS
- **Autentikasi:** Passport.js, Bcrypt

## 📝 To-Do List
### Fitur yang Akan Ditambahkan:
- [ ] **Pengingat H-1 Deadline**  
  - [x] Kirim notifikasi kepada pengguna sehari sebelum tugas jatuh tempo.   
  - [ ] Pastikan notifikasi dikirim hanya untuk tugas yang belum selesai. 
  - [x] Hanya Mengirim ke Nomor yang sudah verifikasi
- [ ] ** Improve Profile**
  - [x] Bisa mengedit nama dan nomor hp
  - [x] Mengirim verifikasi saat mengedit nomor hp
  - [ ] Mengedit email dan verifikasi (Opsional)
## ⚡ Instalasi dan Menjalankan Proyek
1. **Clone Repository**
   ```sh
   git clone https://github.com/username/task-tracker.git
   cd task-tracker
   ```
2. **Instal Dependensi**
   ```sh
   npm install
   ```
3. **Buat File Konfigurasi `.env`**
   Buat file `.env` di root proyek dan tambahkan:
   ```env
   MONGO_URI=your_mongodb_connection_string
   SESSION_SECRET=your_secret_key
   ```
4. **Jalankan Server**
   ```sh
   npm start
   ```
5. **Akses Aplikasi**
   Buka browser dan akses: `http://localhost:3000`



## 🔥 Kontribusi
Jika Anda ingin berkontribusi, silakan fork repository ini dan buat pull request dengan perubahan Anda.

