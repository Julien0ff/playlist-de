const db = require('./lib/db');
const { validateSuggestion } = require('./lib/filter');

const RATE_LIMIT_MAX = 2;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function getRealIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.connection?.remoteAddress || 'unknown';
}

async function checkRateLimit(ip) {
    const key = `rate_limit:${ip}`;
    const now = Date.now();
    let timestamps = await db.getRateLimit(key) || [];
    timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

    if (timestamps.length >= RATE_LIMIT_MAX) {
        const oldest = timestamps[0];
        const remainingMin = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 60000);
        return { allowed: false, remainingMin };
    }

    timestamps.push(now);
    await db.setRateLimit(key, timestamps, RATE_LIMIT_WINDOW_MS);
    return { allowed: true, remainingMin: 0 };
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { slug } = req.query;
    if (!slug) return res.status(400).json({ success: false, message: 'Slug manquant.' });

    const session = await db.getSessionBySlug(slug);
    if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

    if (req.method === 'GET') {
        const status = db.getSessionStatus(session);
        const sessionData = { 
            id: session.id, 
            title: session.title, 
            slug: session.slug, 
            dateStart: session.dateStart, 
            dateEnd: session.dateEnd,
            timeStart: session.timeStart,
            timeEnd: session.timeEnd,
            status 
        };
        
        if (session.isPrivate) {
            return res.json({ success: true, requireAuth: true, session: sessionData });
        }
        return res.json({ success: true, session: sessionData });
    }

    if (req.method === 'POST') {
        const { action, password } = req.body;

        if (action === 'verifyPassword') {
            if (!session.isPrivate) return res.json({ success: true });
            if (session.password === password) return res.json({ success: true });
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
        }

        if (session.isPrivate && session.password !== req.body.password) {
            return res.status(401).json({ success: false, message: 'Non autorisé.' });
        }

        const status = db.getSessionStatus(session);
        if (status !== 'active') return res.status(403).json({ success: false, message: "Session inactive." });

        const { trackName, artistName, albumName, artworkUrl, previewUrl } = req.body;
        if (!trackName || !artistName) return res.status(400).json({ success: false, message: 'Données manquantes.' });

        const ip = getRealIp(req);
        const rateCheck = await checkRateLimit(ip);
        if (!rateCheck.allowed) return res.status(429).json({ success: false, message: `Limite atteinte. Réessaie dans ${rateCheck.remainingMin} min.`, remainingMin: rateCheck.remainingMin });

        const validation = validateSuggestion(trackName, artistName);
        if (!validation.isValid) return res.status(403).json({ success: false, message: validation.reason });

        const existing = await db.getSuggestionsBySession(session.id);
        const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (existing.some(s => normalize(s.trackName) === normalize(trackName) && normalize(s.artistName) === normalize(artistName))) {
            return res.status(409).json({ success: false, duplicate: true, message: "Déjà proposée !" });
        }

        const suggestion = await db.createSuggestion({ sessionId: session.id, trackName, artistName, albumName, artworkUrl, previewUrl });
        return res.json({ success: true, message: 'Suggestion envoyée !', suggestion });
    }

    return res.status(405).json({ success: false, message: "Method Not Allowed" });
};
