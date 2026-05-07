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

    const { sessionId } = req.query;
    if (!sessionId) {
        return res.status(400).json({ success: false, message: 'Session ID requis.' });
    }

    const session = await db.getSessionById(sessionId);
    if (!session) {
        return res.status(404).json({ success: false, message: 'Session introuvable.' });
    }

    const suggestions = await db.getSuggestionsBySession(session.id);
    return res.json({ success: true, suggestions });
};
