const db = require('../lib/db');
const { verifyAdmin } = require('../lib/auth');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Protection Admin
    if (!verifyAdmin(req)) {
        return res.status(401).json({ success: false, message: 'Non autorisé.' });
    }

    if (req.method === 'GET') {
        const sessions = await db.getSessions();
        const suggestions = await db.getSuggestions();
        
        const sessionsWithStatus = sessions.map(s => ({
            ...s,
            status: db.getSessionStatus(s),
            suggestionCount: suggestions.filter(sug => sug.sessionId === s.id).length
        }));

        return res.json({ success: true, sessions: sessionsWithStatus });
    }

    if (req.method === 'POST') {
        const { title, dateStart, dateEnd } = req.body;
        if (!title || !dateStart || !dateEnd) {
            return res.status(400).json({ success: false, message: 'Titre, date de début et date de fin requis.' });
        }

        const slug = title
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        if (await db.getSessionBySlug(slug)) {
            return res.status(409).json({ success: false, message: 'Une session avec un titre similaire existe déjà.' });
        }

        const session = await db.createSession({ title, slug, dateStart, dateEnd });
        return res.json({ success: true, session: { ...session, status: db.getSessionStatus(session) } });
    }

    return res.status(405).json({ success: false, message: "Method Not Allowed" });
};
