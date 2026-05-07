const db = require('../lib/db');
const { validateSuggestion } = require('../lib/filter'); // Need to ensure filter exists in lib or similar
const { kv } = require('@vercel/kv');

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
    let timestamps = await kv.get(key) || [];
    
    // Filter old timestamps
    timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

    if (timestamps.length >= RATE_LIMIT_MAX) {
        const oldestInWindow = timestamps[0];
        const remainingMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow);
        const remainingMin = Math.ceil(remainingMs / 60000);
        return { allowed: false, remainingMin };
    }

    timestamps.push(now);
    await kv.set(key, timestamps, { px: RATE_LIMIT_WINDOW_MS }); // Auto expire
    return { allowed: true, remainingMin: 0 };
}

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

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: "Method Not Allowed" });
    }

    const { slug } = req.query;
    if (!slug) return res.status(400).json({ success: false, message: 'Slug manquant.' });

    const session = await db.getSessionBySlug(slug);
    if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

    const status = db.getSessionStatus(session);
    if (status !== 'active') {
        return res.status(403).json({ success: false, message: "Cette session n'est pas active." });
    }

    const { trackName, artistName, albumName, artworkUrl, previewUrl } = req.body;
    if (!trackName || !artistName) {
        return res.status(400).json({ success: false, message: 'Informations manquantes.' });
    }

    // Rate Limit
    const ip = getRealIp(req);
    const rateCheck = await checkRateLimit(ip);
    if (!rateCheck.allowed) {
        return res.status(429).json({
            success: false,
            message: `Tu as déjà suggéré 2 musiques. Réessaie dans ${rateCheck.remainingMin} min.`,
            remainingMin: rateCheck.remainingMin
        });
    }

    // Filter
    // Note: I'll need to move filter.js to api/lib/ or similar if it's currently in backend/
    const validation = validateSuggestion(trackName, artistName);
    if (!validation.isValid) {
        return res.status(403).json({ success: false, message: validation.reason });
    }

    // Duplicate check
    const existing = await db.getSuggestionsBySession(session.id);
    const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const isDuplicate = existing.some(s =>
        normalize(s.trackName) === normalize(trackName) &&
        normalize(s.artistName) === normalize(artistName)
    );

    if (isDuplicate) {
        return res.status(409).json({
            success: false,
            duplicate: true,
            message: `"${trackName}" de ${artistName} a déjà été proposée !`
        });
    }

    const suggestion = await db.createSuggestion({
        sessionId: session.id,
        trackName,
        artistName,
        albumName,
        artworkUrl,
        previewUrl
    });

    return res.json({ success: true, message: 'Suggestion envoyée !', suggestion });
};
