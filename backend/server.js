require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { validateSuggestion } = require('./filter');
const { searchTrack, addTrackToPlaylist } = require('./spotify');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════
// 🛡️  Rate Limiter par IP — 2 musiques / 15 minutes
// ═══════════════════════════════════════════════════
const RATE_LIMIT_MAX = 2;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes en ms
const ipRequestLog = new Map(); // Map<string, number[]>  ip -> [timestamp, ...]

function getRealIp(req) {
    // Render/Vercel/proxies envoient l'IP réelle dans x-forwarded-for
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
    const now = Date.now();
    const timestamps = ipRequestLog.get(ip) || [];

    // Garder uniquement les timestamps dans la fenêtre actuelle
    const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    ipRequestLog.set(ip, recentTimestamps);

    if (recentTimestamps.length >= RATE_LIMIT_MAX) {
        // Calculer le temps restant avant la prochaine place libre
        const oldestInWindow = recentTimestamps[0];
        const remainingMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow);
        const remainingMin = Math.ceil(remainingMs / 60000);
        return { allowed: false, remainingMin };
    }

    // Enregistrer cette requête
    recentTimestamps.push(now);
    ipRequestLog.set(ip, recentTimestamps);
    return { allowed: true, remainingMin: 0 };
}

// Nettoyage automatique toutes les 5 minutes pour éviter les fuites mémoire
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipRequestLog.entries()) {
        const fresh = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        if (fresh.length === 0) {
            ipRequestLog.delete(ip);
        } else {
            ipRequestLog.set(ip, fresh);
        }
    }
}, 5 * 60 * 1000);

// Middleware
// Configuration CORS pour autoriser le frontend (même hébergé sur une autre URL)
app.use(cors());
app.use(express.json()); // Pour analyser les requêtes JSON

// Servir les fichiers statiques (le site web)
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Route d'API pour recevoir les suggestions de musique
app.post('/api/suggest', async (req, res) => {
    const { trackName, artistName, albumName } = req.body;

    if (!trackName || !artistName) {
        return res.status(400).json({ success: false, message: "Informations manquantes." });
    }

    // 0. Rate Limit par IP
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

    console.log(`📥 Nouvelle suggestion reçue de ${ip} : ${trackName} - ${artistName}`);

    // 1. Filtrage Trolls / Insultes
    const validation = validateSuggestion(trackName, artistName);
    if (!validation.isValid) {
        console.log(`🛑 Bloqué par le filtre: ${validation.reason}`);
        return res.status(403).json({ success: false, message: validation.reason });
    }

    // 2. Recherche sur Spotify
    const searchResult = await searchTrack(trackName, artistName);
    
    if (searchResult.error) {
        console.error(`❌ Erreur API Spotify:`, searchResult.error);
        return res.status(500).json({ success: false, message: `Erreur Spotify: L'API refuse la connexion. (Voir logs serveur)` });
    }

    if (!searchResult.uri) {
        console.log(`❌ Musique introuvable sur Spotify.`);
        return res.status(404).json({ success: false, message: "Musique introuvable sur Spotify." });
    }

    // 3. Ajout à la playlist Spotify
    const added = await addTrackToPlaylist(searchResult.uri);
    if (added) {
        return res.status(200).json({ success: true, message: "Musique ajoutée à la playlist !" });
    } else {
        return res.status(500).json({ success: false, message: "Erreur lors de l'ajout à Spotify." });
    }
});

// Route de base pour vérifier que le serveur tourne (Utile pour bot-hosting.net)
app.get('/', (req, res) => {
    res.send("🚀 Serveur Suggestify en ligne et opérationnel !");
});

// Lancement du serveur
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🟢 Serveur démarré sur le port ${PORT}`);
    console.log(`=========================================`);
});
