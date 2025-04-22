const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');
const Task = require('../models/Task');
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
            return res.render('teams/index', {
                leadTeams, memberTeams,
                message: {
                    title: 'Gagal Membuat Tim',
                    text: 'Anda sudah menjadi leader di tim lain. Hanya diperbolehkan memiliki satu tim.',
                    icon: 'error'
                }
            });
        }

        const team = new Team({
            name: req.body.name,
            description: req.body.description,
            leader: req.user._id,
            members: [req.user._id]
        });

        await team.save();

        res.render('teams/index', {
            leadTeams, memberTeams,
            message: {
                title: 'Tim Berhasil Dibuat!',
                text: 'Tim baru Anda telah berhasil dibuat.',
                icon: 'success'
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).render('teams/index', {
            leadTeams, memberTeams,
            message: {
                title: 'Gagal Membuat Tim',
                text: 'Terjadi kesalahan saat membuat tim.',
                icon: 'error'
            }
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
        const team = await Team.findById(req.params.id);
        const email = req.body.email;

        if (!team) return res.status(404).send('Tim tidak ditemukan');

        const user = await User.findOne({ email });

        if (!user) return res.status(404).send('Pengguna dengan email tersebut tidak ditemukan');

        if (!team.members.includes(user._id)) {
            team.members.push(user._id);
            await team.save();
        }

        res.redirect(`/teams/${team._id}`);
    } catch (err) {
        res.status(500).send('Gagal menambahkan anggota');
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

        res.redirect(`/teams/${team._id}`);

    } catch (err) {
        console.error(err);
        res.status(500).send('Terjadi kesalahan saat menambahkan tugas');
    }
});



module.exports = router;
