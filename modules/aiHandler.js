require('dotenv').config();
const axios = require('axios');
const Profile = require('../models/Profile');
const User = require('../models/User');
const AiSession = require('../models/AiSession');



function normalizePhone(phoneNumber) {
    if (phoneNumber.startsWith('62')) {
        return '0' + phoneNumber.slice(2);
    }
    return phoneNumber;
}

const openRouterCall = async (message, userPhone) => {
    try {
        // Cek profil & plan
        userNumber = normalizePhone(userPhone);
        const profile = await Profile.findOne({ phoneNumber: userNumber });

        if (!profile || !profile.phoneVerified) {
            return { error: "📵 Nomor tidak terdaftar atau belum diverifikasi." };
        }

        const user = await User.findById(profile.user);
        if (!user || user.plan !== 'pro') {
            return { error: "🚫 Fitur AI hanya untuk pengguna plan Pro." };
        }

        // Ambil sesi percakapan (jika ada)
        let session = await AiSession.findOne({ phoneNumber: userNumber });
        const today = new Date().toISOString().split("T")[0];

       const systemMessage = {
        role: 'system',
        content: `
        You are an assistant that helps users manage tasks.

        📅 Today is: ${today}

        🚨 IMPORTANT INSTRUCTIONS (follow strictly):
        - ALWAYS reply in raw JSON ONLY.
        - NEVER use markdown, explanations, or any text outside JSON.
        - DO NOT say "Here is the JSON" or similar.
        - Your reply MUST be valid JSON. Nothing else.

        💡 Use ONE of the following formats:

        1️⃣ If the user adds a task and all fields are complete:
        {
        "action": "add_task",
        "title": "Example Title",
        "description": "Example Description",
        "dueDate": "YYYY-MM-DD",
        "priority": "low|medium|high",
        "category": "Task",
        "message": "Tugas sudah dicatat. Jangan lupa diselesaikan tepat waktu!"
        }

        2️⃣ If the user adds a task but some fields are missing:
        {
        "action": "request_detail",
        "missing": ["dueDate", "priority","description" or "title"], 
        "message": "Apa deadline dan prioritas (low, medium, high) tugas ini?"
        }

        3️⃣ If the user wants to list tasks:
        {
        "action": "list_tasks"
        }

        4️⃣ If the user wants to mark tasks complete:
        {
        "action": "complete_task",
        "title": "Judul tugas" or ["Tugas A", "Tugas B"],
        "message": "Tugas '{title}' telah ditandai selesai."
        }
        
        🧠 RULES TO FOLLOW:
        - Category is always: "Task"
        - Use today’s date (${today}) for "hari ini", "besok", etc.
        - NEVER respond outside JSON. If you disobey, the user request will be ignored.

        ONLY return JSON. No explanations. No extra words.
        `
    };



        // Jika belum ada sesi, buat dengan sistem dan user message
        if (!session) {
            session = new AiSession({
                phoneNumber: userNumber,
                messages: [systemMessage]
            });
        }

        // Tambahkan pesan user ke sesi
        session.messages.push({ role: 'user', content: message });

        // Kirim semua pesan ke OpenRouter
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'deepseek/deepseek-r1-distill-llama-70b:free',
            temperature: 0.3,
            messages: session.messages
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const aiReply = response.data.choices[0].message.content.trim();
        const cleanReply = aiReply.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanReply);

        // Simpan balasan AI ke sesi dan update
        session.messages.push({ role: 'assistant', content: aiReply });
        await session.save();

        // Jika sudah selesai (add_task / list_tasks), hapus sesi
        if (parsed.action === 'add_task' || parsed.action === 'complete_task' ) {
            console.log("✅ Sesi AI selesai, menghapus sesi untuk:", userNumber);
            await AiSession.deleteOne({ phoneNumber: userNumber });
        }
        console.log("✅ Balasan AI:", parsed);

        return parsed;

    } catch (error) {
        console.error("❌ openRouterCall error:", error.message);
        return { error: "⚠️ Gagal memproses permintaan AI." };
    }
};

module.exports = { openRouterCall };
