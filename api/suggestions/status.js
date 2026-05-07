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

    if (req.method !== 'PUT') {
        return res.status(405).json({ success: false, message: "Method Not Allowed" });
    }

    const { id, action } = req.body;
    if (!id || !action) {
        return res.status(400).json({ success: false, message: 'ID et Action requis.' });
    }

    let suggestion;
    if (action === 'accept') {
        suggestion = await db.updateSuggestionStatus(id, 'accepted');
    } else if (action === 'done') {
        suggestion = await db.updateSuggestionStatus(id, 'done');
    } else if (action === 'reject') {
        await db.deleteSuggestion(id);
        return res.json({ success: true });
    } else {
        return res.status(400).json({ success: false, message: 'Action invalide.' });
    }

    if (!suggestion) {
        return res.status(404).json({ success: false, message: 'Suggestion introuvable.' });
    }

    return res.json({ success: true, suggestion });
};
