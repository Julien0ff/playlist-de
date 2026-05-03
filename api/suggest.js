const { validateSuggestion } = require('./filter');
const { searchTrack, addTrackToPlaylist } = require('./spotify');

module.exports = async (req, res) => {
    // Configuration CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Gérer la requête preflight CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: "Method Not Allowed" });
    }

    const { trackName, artistName, albumName } = req.body;

    if (!trackName || !artistName) {
        return res.status(400).json({ success: false, message: "Informations manquantes." });
    }

    console.log(`📥 Nouvelle suggestion reçue : ${trackName} - ${artistName}`);

    // 1. Filtrage Trolls / Insultes
    const validation = validateSuggestion(trackName, artistName);
    if (!validation.isValid) {
        console.log(`🛑 Bloqué par le filtre: ${validation.reason}`);
        return res.status(403).json({ success: false, message: validation.reason });
    }

    // 2. Recherche sur Spotify
    const trackUri = await searchTrack(trackName, artistName);
    if (!trackUri) {
        console.log(`❌ Musique introuvable sur Spotify.`);
        return res.status(404).json({ success: false, message: "Musique introuvable sur Spotify." });
    }

    // 3. Ajout à la playlist Spotify
    const added = await addTrackToPlaylist(trackUri);
    if (added) {
        return res.status(200).json({ success: true, message: "Musique ajoutée à la playlist !" });
    } else {
        return res.status(500).json({ success: false, message: "Erreur lors de l'ajout à Spotify." });
    }
};
