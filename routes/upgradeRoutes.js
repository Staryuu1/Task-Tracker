const express = require('express');
const router = express.Router();
const midtransClient = require('midtrans-client');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Konfigurasi Midtrans
const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});


router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const midtransClientKey = process.env.MIDTRANS_CLIENT_KEY;
    res.render('upgrade', { user, midtransClientKey });
  } catch (err) {
    res.status(500).render('error', { message: 'Gagal memuat halaman upgrade.' });
  }
});

router.post('/midtrans-token', ensureAuthenticated, async (req, res) => {
  try {
    // Cek transaksi pending
    let trx = await Transaction.findOne({ userId: req.user._id, status: 'pending' });
    if (trx) {
        return res.json({ token: trx.snapToken });
    }
    const parameter = {
      transaction_details: {
        order_id: 'pro-' + Date.now() + '-' + req.user._id,
        gross_amount: 50000
      },
      customer_details: {
        first_name: req.user.username,
        email:  req.user.email,
      }
    };
    const transaction = await snap.createTransaction(parameter);
    
    await Transaction.create({
      userId: req.user._id,
      orderId: parameter.transaction_details.order_id,
      snapToken: transaction.token,
      status: 'pending'
    });
    res.json({ token: transaction.token });
  } catch (err) {
    console.error('Error creating Midtrans token:', err);
    res.status(500).json({ error: 'Gagal membuat token pembayaran.' });
  }
});



router.get('/check-status', ensureAuthenticated, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const trx = await Transaction.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
    if (!trx) return res.json({ status: 'no_transaction' });
    
    const statusResponse = await snap.transaction.status(trx.orderId);

    trx.status = statusResponse.transaction_status;
    await trx.save();

   
    if (trx.status === 'settlement' || trx.status === 'capture') {
        const now = new Date();
        const expired = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await User.findByIdAndUpdate(
            req.user._id,
            { plan: 'pro', upgradeDate: now, planExpired: expired },
            { new: true }
        );
    }

    res.json({ status: trx.status });
  } catch (err) {
    res.status(500).json({ error: 'Gagal cek status pembayaran.' });
  }
});


router.post('/midtrans-webhook', async (req, res) => {
  try {
    const { order_id } = req.body;


    const notif = await snap.transaction.status(order_id); 


    const trx = await Transaction.findOneAndUpdate(
      { orderId: notif.order_id },
      { status: notif.transaction_status },
      { new: true }
    );

    if (notif.transaction_status === 'settlement' || notif.transaction_status === 'capture') {
      const userId = trx ? trx.userId : notif.order_id.split('-').pop();
      const now = new Date();
      const expired = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await User.findByIdAndUpdate(
        userId,
        { plan: 'pro', upgradeDate: now, planExpired: expired },
        { new: true }
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Midtrans notification error:', err.message);
    res.status(500).send('Error');
  }
});


module.exports = router;

