require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { validateSuggestion } = require('./filter');
const { searchTrack, addTrackToPlaylist } = require('./spotify');

const app = express();
const PORT = process.env.PORT || 3000;

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

    console.log(`📥 Nouvelle suggestion reçue : ${trackName} - ${artistName}`);

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
