const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');
const Task = require('../models/Task');
const {sendEmailReminder} = require('../modules/mailer');
const jwt = require('jsonwebtoken');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Lihat semua tim milik user
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const allTeams = await Team.find({ members: req.user._id }).populate('members leader');
        
        const leadTeams = allTeams.filter(team => team.leader._id.equals(req.user._id));
        const memberTeams = allTeams.filter(team => !team.leader._id.equals(req.user._id));

        res.render('teams/index', { leadTeams, memberTeams });
    } catch (err) {
        res.status(500).send('Terjadi kesalahan saat memuat daftar tim');
    }
});



router.post('/create', ensureAuthenticated, async (req, res) => {
    try {
        const existingTeam = await Team.findOne({ leader: req.user._id });
        const allTeams = await Team.find({ members: req.user._id }).populate('members leader');
        
        const leadTeams = allTeams.filter(team => team.leader._id.equals(req.user._id));
        const memberTeams = allTeams.filter(team => !team.leader._id.equals(req.user._id));
        if (existingTeam) {
            if (existingTeam) {
                return res.status(400).json({
                  error: 'Anda sudah menjadi leader di tim lain. Hanya diperbolehkan memiliki satu tim.'
                });
            }
        }

        const team = new Team({
            name: req.body.name,
            description: req.body.description,
            leader: req.user._id,
            members: [req.user._id]
        });

        await team.save();

        return res.status(201).json({
            message: 'Tim berhasil dibuat.'
        });
      

    } catch (err) {
        console.error(err);
        return res.status(500).json({
        error: 'Terjadi kesalahan saat membuat tim.'
        });
    }
});


router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate('leader')
            .populate('members')
            .populate('tasks');

        if (!team) return res.status(404).send('Tim tidak ditemukan');
        res.render('teams/show', { team, user: req.user });
    } catch (err) {
        console.log(err)
        res.status(500).send('Gagal memuat detail tim');
    }
});



router.post('/:id/add-member', ensureAuthenticated, async (req, res) => {
    try {
        const { email } = req.body;
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).send('❌ Tim tidak ditemukan');

        const user = await User.findOne({ email });
        if (!user) return res.status(404).send('❌ Pengguna dengan email tersebut tidak ditemukan');

       
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const inviteLink = `${process.env.BASE_URL}/teams/${team._id}/invite/${token}`;

       
        const subject = `📩 Undangan Bergabung ke Tim "${team.name}"`;
        const plainText = `
        Hai ${user.username || 'Teman'}, 

        Kamu diundang untuk bergabung ke tim "${team.name}".

        Klik link berikut untuk bergabung:
        ${inviteLink}

        Link ini akan kadaluarsa dalam 1 jam.
        `;

        const html = `
        <h3>📩 Undangan Bergabung ke Tim "<strong>${team.name}</strong>"</h3>
        <p>Halo ${user.username || 'Teman'},</p>
        <p>Kamu diundang untuk bergabung ke tim "<strong>${team.name}</strong>".</p>
        <p>Klik tombol di bawah ini untuk menerima undangan:</p>
        <a href="${inviteLink}" style="display:inline-block; padding:10px 20px; background-color:#000; color:#fff; border-radius:5px; text-decoration:none;">Gabung Sekarang</a>
        <p>atau tekan tautan di bawah ini untuk menerima undangan:</p>
        ${inviteLink}
        <p><small>⚠️ Link ini berlaku selama 1 jam.</small></p>
        `;

        await sendEmailReminder(user.email, subject, html, plainText);
        console.log(`✅ Undangan dikirim ke ${user.email}`);

        res.render('teams/show', { team, user: req.user,  message: {
            title: 'Undangan Terkirim!',
            text: `Undangan berhasil dikirim ke ${user.email}.`,
            icon: 'success'
        } });
    } catch (err) {
        console.error(err);
        res.status(500).send('❌ Gagal mengirim undangan');
    }
});


router.get("/:id/invite/:token", ensureAuthenticated, async (req, res) => {
    try {
        const { token } = req.params;
        const team = await Team.findById(req.params.id)
            .populate('leader')
            .populate('members')
            .populate('tasks');

        if (!team) return res.status(404).send('Tim tidak ditemukan');

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });

        if (!user) return res.status(404).send('Pengguna tidak ditemukan');

        if (!req.user._id.equals(user._id)) {
            return res.status(403).send('Undangan ini bukan untuk akun kamu');
        }

        const isMember = team.members.some(memberId => memberId.equals(user._id));

        
        if (!isMember) {
            team.members.push(user._id);
            await team.save();

            res.render('teams/show', { 
                team, 
                user: req.user,  
                message: {
                    title: 'Berhasil Bergabung',
                    text: `Kamu berhasil bergabung ke tim!`,
                    icon: 'success'
                } 
            });
        } else {
            res.render('teams/show', { 
                team, 
                user: req.user,  
                message: {
                    title: 'Sudah Bergabung',
                    text: `Kamu sudah menjadi anggota tim.`,
                    icon: 'info'
                } 
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan saat memproses undangan.");
    }
});

router.post('/:id/add-task', ensureAuthenticated, async (req, res) => {

    try {
        const team = await Team.findById(req.params.id);

        if (!team) return res.status(404).send('Tim tidak ditemukan');

        if (team.leader._id.toString() !== req.user._id.toString()) {
            return res.status(403).send('Hanya leader yang dapat menambahkan tugas');
        }
        
        const newTask = new Task({
            title: req.body.title,
            description: req.body.description,
            dueDate: req.body.dueDate,
            priority: req.body.priority,
            category: "Team",  
            completed: false,  
            user: team.leader._id,  
        });
        await newTask.save();

        team.tasks.push(newTask);
        await team.save();

       
        return res.status(200).json({
            message: 'Tugas berhasil Ditambahkan.'
        });
      
         

    } catch (err) {
        console.error(err);
        res.status(500).send('Terjadi kesalahan saat menambahkan tugas');
    }
});

router.post('/:id/add-meet', ensureAuthenticated, async (req, res) => {

    try {
        const team = await Team.findById(req.params.id);

        if (!team) return res.status(404).send('Tim tidak ditemukan');

        if (team.leader._id.toString() !== req.user._id.toString()) {
            return res.status(403).send('Hanya leader yang dapat menjadwalkan meeting');
        }
        
        const newTask = new Task({
            title: req.body.title,
            description: req.body.description,
            dueDate: new Date(req.body.dueDate),
            priority: req.body.priority,
            category: "Meeting",  
            completed: false,  
            user: team.leader._id,  
        });
        await newTask.save();

        team.tasks.push(newTask);
        await team.save();
       
        return res.status(200).json({
            message: 'Meeting berhasil dijawlaknan.'
        });
      
         

    } catch (err) {
        console.error(err);
        res.status(500).send('Terjadi kesalahan saat menjadwalkan meeting');
    }
});


module.exports = router;
