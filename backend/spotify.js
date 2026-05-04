const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
});

// ID de la playlist où les musiques seront ajoutées
const PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID;

/**
 * Rafraîchit l'Access Token Spotify avant d'effectuer une action
 */
async function refreshAccessToken() {
    try {
        const data = await spotifyApi.refreshAccessToken();
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log("✅ Token Spotify rafraîchi avec succès");
    } catch (error) {
        console.error("❌ Erreur lors du rafraîchissement du token Spotify:", error.message);
        throw error;
    }
}

/**
 * Recherche une musique sur Spotify
 * @param {string} trackName 
 * @param {string} artistName 
 * @returns {string|null} L'URI de la musique sur Spotify ou null si non trouvée
 */
async function searchTrack(trackName, artistName) {
    try {
        await refreshAccessToken();
        
        // Clean names to improve search matches (e.g. remove "feat." and "- Single")
        const cleanTrackName = trackName.split('(')[0].split('-')[0].trim();
        const cleanArtistName = artistName.split(',')[0].split('&')[0].trim();
        
        const query = `track:${cleanTrackName} artist:${cleanArtistName}`;
        const data = await spotifyApi.searchTracks(query, { limit: 1 });
        
        if (data.body.tracks && data.body.tracks.items.length > 0) {
            return { uri: data.body.tracks.items[0].uri, error: null };
        }
        
        const fallbackData = await spotifyApi.searchTracks(cleanTrackName, { limit: 1 });
        if (fallbackData.body.tracks && fallbackData.body.tracks.items.length > 0) {
            return { uri: fallbackData.body.tracks.items[0].uri, error: null };
        }
        
        return { uri: null, error: null };
    } catch (error) {
        console.error("❌ Erreur lors de la recherche Spotify:", error);
        const util = require('util');
        return { uri: null, error: util.inspect(error, { depth: 3 }) };
    }
}

/**
 * Ajoute une musique (par son URI) à la playlist
 * @param {string} trackUri 
 * @returns {boolean} true si succès, false sinon
 */
async function addTrackToPlaylist(trackUri) {
    if (!PLAYLIST_ID) {
        console.error("❌ SPOTIFY_PLAYLIST_ID non configuré dans le fichier .env");
        return false;
    }

    try {
        await refreshAccessToken();
        await spotifyApi.addTracksToPlaylist(PLAYLIST_ID, [trackUri]);
        console.log(`✅ Musique ajoutée à la playlist: ${trackUri}`);
        return true;
    } catch (error) {
        console.error("❌ Erreur lors de l'ajout à la playlist:", error.message);
        return false;
    }
}

module.exports = {
    searchTrack,
    addTrackToPlaylist
};
