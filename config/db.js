const mongoose = require("mongoose");
require("dotenv").config(); // Pastikan dotenv di-load di awal

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,      // Opsi ini sudah tidak perlu di MongoDB 4.0+
      useUnifiedTopology: true,   // Opsi ini sudah tidak perlu di MongoDB 4.0+
    });
    console.log("✅ Terhubung ke MongoDB");
  } catch (err) {
    console.error("❌ Koneksi MongoDB gagal:", err.message);
    process.exit(1); // Keluar dari proses jika koneksi gagal
  }
};

module.exports = connectDB;
