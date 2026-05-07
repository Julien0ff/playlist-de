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

    if (!verifyAdmin(req)) {
        return res.status(401).json({ success: false, message: 'Non autorisé.' });
    }

    const { id } = req.query;

    if (req.method === 'PUT') {
        const { title, dateStart, dateEnd } = req.body;
        const updates = {};
        if (title) {
            updates.title = title;
            updates.slug = title
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
        }
        if (dateStart) updates.dateStart = dateStart;
        if (dateEnd) updates.dateEnd = dateEnd;

        const session = await db.updateSession(id, updates);
        if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });
        return res.json({ success: true, session: { ...session, status: db.getSessionStatus(session) } });
    }

    if (req.method === 'DELETE') {
        const deleted = await db.deleteSession(id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Session introuvable.' });
        return res.json({ success: true });
    }

    return res.status(405).json({ success: false, message: "Method Not Allowed" });
};
