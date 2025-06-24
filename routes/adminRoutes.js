const express = require("express");
const User = require("../models/User");
const Task = require("../models/Task");
const Team = require("../models/Team");
const Profile = require("../models/Profile");
const midtransClient = require('midtrans-client');
const Transaction = require('../models/Transaction');
const { client, sendWhatsAppMessage } = require('../modules/reminder');

const router = express.Router();

const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});


// Middleware: Batasi hanya untuk admin (contoh, sesuaikan dengan field role di User)
function ensureAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).send("Forbidden: Admins only");
}


router.get("/", ensureAdmin, async (req, res) => {
  try {
    const [userCount, taskCount, teamCount] = await Promise.all([
      User.countDocuments(),
      Task.countDocuments(),
      Team.countDocuments()
    ]);

    const completedTaskCount = await Task.countDocuments({ completed: true });
    const pendingTaskCount = await Task.countDocuments({ completed: false });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: oneWeekAgo } });

    const overdueTasks = await Task.find({
      dueDate: { $lt: new Date() },
      completed: false
    }).limit(5).populate('user');

    const latestTasks = await Task.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user");

    res.render("admin/adminDashboard", {
      userCount,
      taskCount,
      teamCount,
      completedTaskCount,
      pendingTaskCount,
      newUsersThisWeek,
      overdueTasks,
      latestTasks
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});



router.get("/users", ensureAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "_id username email role plan").lean();
    const profiles = await Profile.find({}, "user emailVerified phoneVerified").lean();

    // Gabungkan data user dengan profile
    const usersWithProfile = users.map(user => {
      const profile = profiles.find(p => p.user.toString() === user._id.toString());
      return {
        ...user,
        profile: profile || {}  
      };
    });

    const message = req.session.message;
    delete req.session.message;

    res.render("admin/adminUsers", { users: usersWithProfile, message });

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});



router.post("/users/:id/role", ensureAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).send("Invalid role");
    await User.findByIdAndUpdate(req.params.id, { role });
    req.session.message = { title: 'Berhasil', text: 'Role user berhasil diubah.', icon: 'success' };
    res.redirect("/admin/users");
  } catch (err) {
    req.session.message = { title: 'Gagal', text: 'Gagal mengubah role user.', icon: 'error' };
    res.redirect("/admin/users");
  }
});


router.post("/users/:id/plan", ensureAdmin, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['basic', 'pro'].includes(plan)) return res.status(400).send("Invalid plan");
    await User.findByIdAndUpdate(req.params.id, { plan });
    req.session.message = { title: 'Berhasil', text: 'Plan user berhasil diubah.', icon: 'success' };
    res.redirect("/admin/users");
  } catch (err) {
    req.session.message = { title: 'Gagal', text: 'Gagal mengubah plan user.', icon: 'error' };
    res.redirect("/admin/users");
  }
});

router.post("/users/:id/delete", ensureAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    req.session.message = { title: 'Berhasil', text: 'User berhasil dihapus.', icon: 'success' };
    res.redirect("/admin/users");
  } catch (err) {
    req.session.message = { title: 'Gagal', text: 'Gagal menghapus user.', icon: 'error' };
    res.redirect("/admin/users");
  }
});

router.get("/transactions", ensureAdmin, async (req, res) => {
  try {
    const { search } = req.query;

    const query = {};
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { orderId: regex },
        { status: regex },
        { userId: { $in: await User.find({ $or: [{ username: regex }, { email: regex }] }).distinct('_id') } }
      ];
    }

    const transactions = await Transaction.find(query)
      .populate("userId", "username email")
      .sort({ createdAt: -1 })
      .limit(50);

    res.render("admin/adminTransactions", { transactions, search });
  } catch (err) {
    console.error("Error loading transactions:", err);
    res.status(500).send("Gagal memuat transaksi.");
  }
});

router.post('/check-status/:trxId', ensureAdmin, async (req, res) => {
  try {
    const trx = await Transaction.findById(req.params.trxId).populate('userId');
    if (!trx) return res.status(404).send('Transaksi tidak ditemukan.');
    console.log(`Memeriksa status transaksi: ${trx.orderId}`);
    if (trx.status == 'pending') {
      const statusResponse = await snap.transaction.status(trx.orderId);
      trx.status = statusResponse.transaction_status;
      await trx.save();

      if (trx.status === 'settlement' || trx.status === 'capture') {
        const now = new Date();
        const expired = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await User.findByIdAndUpdate(trx.userId._id, {
          plan: 'pro',
          upgradeDate: now,
          planExpired: expired
        });
        
        return res.json({
          title: 'Berhasil',
          message: `Status transaksi berhasil diperbarui.`,
          icon: 'success'
        });
      }
    }
    return res.json({
      title: 'Gagal',
      message: `Gagal Memperbarui status transaksi. Status saat ini: ${trx.status}`,
      icon: 'error'
    });
    
  } catch (err) {
      return res.status(500).json({
        title: 'Gagal Memeriksa Status',
        message: 'Terjadi kesalahan saat memeriksa ulang status transaksi.',
        icon: 'error'
      });
  }
});


router.get('/wa', ensureAdmin, (req, res) => {
  res.render('admin/adminWA', { stats: waStats });
});


router.get('/wa-status', ensureAdmin, async (req, res) => {
  try {
    let status = 'Tidak diketahui';
    if (client.info && client.info.wid) {
      status = 'Online sebagai: ' + client.info.pushname + ' (' + client.info.wid.user + ')';
    } else if (client.info && client.info.me) {
      status = 'Online sebagai: ' + client.info.me.user;
    } else if (client.info && client.info.connected) {
      status = 'Online';
    } else if (client.info && client.info.authenticated) {
      status = 'Authenticated, menunggu koneksi...';
    } else if (client.info && client.info.pairing) {
      status = 'Menunggu scan QR';
    } else {
      status = client.info ? JSON.stringify(client.info) : 'Belum login';
    }
    res.json({ status });
  } catch (err) {
    res.json({ status: 'Tidak diketahui' });
  }
});


router.post('/wa-restart', ensureAdmin, async (req, res) => {
  try {
    await client.destroy();
    await client.initialize();
    res.json({ message: 'Bot WhatsApp berhasil direstart.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal restart bot.' });
  }
});

// WhatsApp Broadcast (admin)
router.post('/wa-broadcast', ensureAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.json({ title: 'Gagal', message: 'Pesan tidak boleh kosong', icon: 'warning' });
    const profiles = await Profile.find({ phoneNumber: { $exists: true }, phoneVerified: true, whatsappNotif: true });
    let success = 0, failed = 0;
    for (const profile of profiles) {
      try {
        await sendWhatsAppMessage(profile.phoneNumber, message);
        success++;
      } catch {
        failed++;
      }
    }
    waStats.totalBroadcast = (waStats.totalBroadcast || 0) + 1;
    res.json({ title: 'Broadcast Selesai', message: `Terkirim: ${success}, Gagal: ${failed}`, icon: 'success' });
  } catch (err) {
    res.json({ title: 'Gagal', message: 'Gagal mengirim broadcast', icon: 'error' });
  }
});


router.post('/wa-send', ensureAdmin, async (req, res) => {
  try {
    const { number, message } = req.body;
    if (!number || !message) return res.json({ title: 'Gagal', message: 'Nomor dan pesan wajib diisi', icon: 'warning' });
    await sendWhatsAppMessage(number, message);
    res.json({ title: 'Berhasil', message: 'Pesan berhasil dikirim', icon: 'success' });
  } catch (err) {
    res.json({ title: 'Gagal', message: 'Gagal mengirim pesan', icon: 'error' });
  }
});

let waStats = { incoming: 0, outgoing: 0, uniqueUsers: 0, totalBroadcast: 0 };
if (client) {
  client.on('message', msg => {
    waStats.incoming++;
    waStats.lastSender = msg.from;
    waStats.uniqueUsersSet = waStats.uniqueUsersSet || new Set();
    waStats.uniqueUsersSet.add(msg.from);
    waStats.uniqueUsers = waStats.uniqueUsersSet.size;
  });
  const origSend = client.sendMessage;
  client.sendMessage = async function(...args) {
    waStats.outgoing++;
    return origSend.apply(this, args);
  };
}

module.exports = router;
