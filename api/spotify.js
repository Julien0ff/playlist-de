const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
});

const PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID;

async function refreshAccessToken() {
    try {
        const data = await spotifyApi.refreshAccessToken();
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log("Token Spotify rafraîchi avec succès");
    } catch (error) {
        console.error("Erreur lors du rafraîchissement du token Spotify:", error.message);
        throw error;
    }
}

async function searchTrack(trackName, artistName) {
    try {
        await refreshAccessToken();
        
        // Clean names to improve search matches
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
        console.error("Erreur lors de la recherche Spotify:", error);
        return { uri: null, error: error.message || "Erreur de l'API Spotify" };
    }
}

async function addTrackToPlaylist(trackUri) {
    if (!PLAYLIST_ID) {
        console.error("SPOTIFY_PLAYLIST_ID non configuré");
        return false;
    }

    try {
        await refreshAccessToken();
        await spotifyApi.addTracksToPlaylist(PLAYLIST_ID, [trackUri]);
        console.log(`Musique ajoutée à la playlist: ${trackUri}`);
        return true;
    } catch (error) {
        console.error("Erreur lors de l'ajout à la playlist:", error.message);
        return false;
    }
}

module.exports = {
    searchTrack,
    addTrackToPlaylist
};
