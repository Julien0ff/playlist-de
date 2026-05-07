const db = require('../lib/db');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { slug } = req.query;
    if (!slug) {
        return res.status(400).json({ success: false, message: 'Slug requis.' });
    }

    const session = await db.getSessionBySlug(slug);
    if (!session) {
        return res.status(404).json({ success: false, message: 'Session introuvable.' });
    }

    const status = db.getSessionStatus(session);
    return res.json({
        success: true,
        session: {
            id: session.id,
            title: session.title,
            slug: session.slug,
            dateStart: session.dateStart,
            dateEnd: session.dateEnd,
            status
        }
    });
};
