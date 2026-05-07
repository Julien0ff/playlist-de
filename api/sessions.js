const db = require('./lib/db');
const { verifyAdmin } = require('./lib/auth');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: 'Non autorisé.' });

    const { id } = req.query;

    switch (req.method) {
        case 'GET':
            const sessions = await db.getSessions();
            const suggestions = await db.getSuggestions();
            const sessionsWithStatus = sessions.map(s => ({
                ...s,
                status: db.getSessionStatus(s),
                suggestionCount: suggestions.filter(sug => sug.sessionId === s.id).length
            }));
            return res.json({ success: true, sessions: sessionsWithStatus });

        case 'POST':
            const { title, dateStart, timeStart, dateEnd, timeEnd, isPrivate, password } = req.body;
            if (!title || !dateStart || !dateEnd) return res.status(400).json({ success: false, message: 'Données manquantes.' });
            
            const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            if (await db.getSessionBySlug(slug)) return res.status(409).json({ success: false, message: 'Slug déjà existant.' });
            
            const session = await db.createSession({ title, slug, dateStart, timeStart, dateEnd, timeEnd, isPrivate, password });
            return res.json({ success: true, session: { ...session, status: db.getSessionStatus(session) } });

        case 'PUT':
            if (!id) return res.status(400).json({ success: false, message: 'ID manquant.' });
            const updates = req.body;
            if (updates.title) {
                updates.slug = updates.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            }
            const updated = await db.updateSession(id, updates);
            if (!updated) return res.status(404).json({ success: false, message: 'Session introuvable.' });
            return res.json({ success: true, session: { ...updated, status: db.getSessionStatus(updated) } });

        case 'DELETE':
            if (!id) return res.status(400).json({ success: false, message: 'ID manquant.' });
            const deleted = await db.deleteSession(id);
            if (!deleted) return res.status(404).json({ success: false, message: 'Session introuvable.' });
            return res.json({ success: true });

        default:
            return res.status(405).json({ success: false, message: "Method Not Allowed" });
    }
};
