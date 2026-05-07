require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { validateSuggestion } = require('./filter');
const { login, requireAdmin } = require('./auth');
const db = require('./dataStore');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════
// 🛡️  Rate Limiter par IP — 2 musiques / 15 minutes
// ═══════════════════════════════════════════════════
const RATE_LIMIT_MAX = 2;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const ipRequestLog = new Map();

function getRealIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
    const now = Date.now();
    const timestamps = ipRequestLog.get(ip) || [];
    const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    ipRequestLog.set(ip, recentTimestamps);

    if (recentTimestamps.length >= RATE_LIMIT_MAX) {
        const oldestInWindow = recentTimestamps[0];
        const remainingMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow);
        const remainingMin = Math.ceil(remainingMs / 60000);
        return { allowed: false, remainingMin };
    }

    recentTimestamps.push(now);
    ipRequestLog.set(ip, recentTimestamps);
    return { allowed: true, remainingMin: 0 };
}

// Nettoyage automatique toutes les 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipRequestLog.entries()) {
        const fresh = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        if (fresh.length === 0) ipRequestLog.delete(ip);
        else ipRequestLog.set(ip, fresh);
    }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════
// Middleware
// ═══════════════════════════════════════════════════
app.use(cors());
app.use(express.json());

// Servir les fichiers statiques depuis la racine du projet
const ROOT_DIR = path.join(__dirname, '..');
app.use('/assets', express.static(path.join(ROOT_DIR, 'assets')));

// ═══════════════════════════════════════════════════
// 🔐 AUTH
// ═══════════════════════════════════════════════════
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ success: false, message: 'Mot de passe requis.' });
    }
    const result = login(password);
    if (result.success) {
        console.log('🔐 Admin connecté');
        return res.json({ success: true, token: result.token });
    }
    return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
});

// ═══════════════════════════════════════════════════
// 📅 SESSIONS — Admin (protégé)
// ═══════════════════════════════════════════════════
app.get('/api/admin/sessions', requireAdmin, (req, res) => {
    const sessions = db.getSessions().map(s => ({
        ...s,
        status: db.getSessionStatus(s),
        suggestionCount: db.getSuggestionsBySession(s.id).length
    }));
    res.json({ success: true, sessions });
});

app.post('/api/admin/sessions', requireAdmin, (req, res) => {
    const { title, dateStart, dateEnd } = req.body;
    if (!title || !dateStart || !dateEnd) {
        return res.status(400).json({ success: false, message: 'Titre, date de début et date de fin requis.' });
    }

    // Générer le slug depuis le titre
    const slug = title
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    // Vérifier que le slug n'existe pas déjà
    if (db.getSessionBySlug(slug)) {
        return res.status(409).json({ success: false, message: 'Une session avec un titre similaire existe déjà.' });
    }

    const session = db.createSession({ title, slug, dateStart, dateEnd });
    console.log(`📅 Nouvelle session créée: "${title}" (${slug})`);
    res.json({ success: true, session: { ...session, status: db.getSessionStatus(session) } });
});

app.put('/api/admin/sessions/:id', requireAdmin, (req, res) => {
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

    const session = db.updateSession(req.params.id, updates);
    if (!session) {
        return res.status(404).json({ success: false, message: 'Session introuvable.' });
    }
    res.json({ success: true, session: { ...session, status: db.getSessionStatus(session) } });
});

app.delete('/api/admin/sessions/:id', requireAdmin, (req, res) => {
    const deleted = db.deleteSession(req.params.id);
    if (!deleted) {
        return res.status(404).json({ success: false, message: 'Session introuvable.' });
    }
    res.json({ success: true });
});

// ═══════════════════════════════════════════════════
// 🎵 SUGGESTIONS — Admin (protégé)
// ═══════════════════════════════════════════════════
app.get('/api/admin/sessions/:id/suggestions', requireAdmin, (req, res) => {
    const session = db.getSessionById(req.params.id);
    if (!session) {
        return res.status(404).json({ success: false, message: 'Session introuvable.' });
    }
    const suggestions = db.getSuggestionsBySession(session.id);
    res.json({ success: true, suggestions });
});

app.put('/api/admin/suggestions/:id/accept', requireAdmin, (req, res) => {
    const suggestion = db.updateSuggestionStatus(req.params.id, 'accepted');
    if (!suggestion) {
        return res.status(404).json({ success: false, message: 'Suggestion introuvable.' });
    }
    res.json({ success: true, suggestion });
});

app.put('/api/admin/suggestions/:id/reject', requireAdmin, (req, res) => {
    db.deleteSuggestion(req.params.id);
    res.json({ success: true });
});

app.put('/api/admin/suggestions/:id/done', requireAdmin, (req, res) => {
    const suggestion = db.updateSuggestionStatus(req.params.id, 'done');
    if (!suggestion) {
        return res.status(404).json({ success: false, message: 'Suggestion introuvable.' });
    }
    res.json({ success: true, suggestion });
});

// ═══════════════════════════════════════════════════
// 🌐 SESSIONS — Public
// ═══════════════════════════════════════════════════
app.get('/api/sessions/:slug', (req, res) => {
    const session = db.getSessionBySlug(req.params.slug);
    if (!session) {
        return res.status(404).json({ success: false, message: 'Session introuvable.' });
    }
    const status = db.getSessionStatus(session);
    res.json({
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
});

// ═══════════════════════════════════════════════════
// 🎵 SUGGESTIONS — Public (soumettre)
// ═══════════════════════════════════════════════════
app.post('/api/sessions/:slug/suggest', async (req, res) => {
    const session = db.getSessionBySlug(req.params.slug);
    if (!session) {
        return res.status(404).json({ success: false, message: 'Session introuvable.' });
    }

    const status = db.getSessionStatus(session);
    if (status !== 'active') {
        return res.status(403).json({ success: false, message: 'Cette session n\'est pas active.' });
    }

    const { trackName, artistName, albumName, artworkUrl, previewUrl } = req.body;
    if (!trackName || !artistName) {
        return res.status(400).json({ success: false, message: 'Informations manquantes.' });
    }

    // Rate Limit
    const ip = getRealIp(req);
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
        console.log(`⏳ Rate limit atteint pour ${ip} — encore ${rateCheck.remainingMin} min`);
        return res.status(429).json({
            success: false,
            message: `Tu as déjà suggéré 2 musiques. Réessaie dans ${rateCheck.remainingMin} min.`,
            remainingMin: rateCheck.remainingMin
        });
    }

    // Filtrage
    const validation = validateSuggestion(trackName, artistName);
    if (!validation.isValid) {
        console.log(`🛑 Bloqué par le filtre: ${validation.reason}`);
        return res.status(403).json({ success: false, message: validation.reason });
    }

    // Doublon — vérifier si la même musique a déjà été proposée pour cette session
    const existing = db.getSuggestionsBySession(session.id);
    const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const isDuplicate = existing.some(s =>
        normalize(s.trackName) === normalize(trackName) &&
        normalize(s.artistName) === normalize(artistName)
    );
    if (isDuplicate) {
        console.log(`🔁 Doublon détecté: ${trackName} - ${artistName}`);
        return res.status(409).json({
            success: false,
            duplicate: true,
            message: `"${trackName}" de ${artistName} a déjà été proposée pour cette session !`
        });
    }

    console.log(`📥 Suggestion reçue (${session.title}): ${trackName} - ${artistName}`);

    const suggestion = db.createSuggestion({
        sessionId: session.id,
        trackName,
        artistName,
        albumName,
        artworkUrl,
        previewUrl
    });

    res.json({ success: true, message: 'Suggestion envoyée !', suggestion });
});

// ═══════════════════════════════════════════════════
// 📄 Servir les pages HTML
// ═══════════════════════════════════════════════════

// Admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'admin.html'));
});

// Admin assets
app.get('/admin.js', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'admin.js'));
});
app.get('/admin.css', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'admin.css'));
});

// Session page (dynamic slug)
app.get('/session/:slug', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// Also serve app.js and styles.css
app.get('/app.js', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'app.js'));
});
app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'styles.css'));
});

// Root redirect: show a list of sessions or redirect to admin
app.get('/', (req, res) => {
    res.redirect('/admin');
});

// ═══════════════════════════════════════════════════
// 🚀 Lancement
// ═══════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🟢 Serveur Suggestify démarré sur le port ${PORT}`);
    console.log(`   Admin  → http://localhost:${PORT}/admin`);
    console.log(`=========================================`);
});
