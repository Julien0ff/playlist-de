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
        
        const query = `track:${trackName} artist:${artistName}`;
        const data = await spotifyApi.searchTracks(query, { limit: 1 });
        
        if (data.body.tracks.items.length > 0) {
            return data.body.tracks.items[0].uri;
        }
        
        const fallbackData = await spotifyApi.searchTracks(trackName, { limit: 1 });
        if (fallbackData.body.tracks.items.length > 0) {
            return fallbackData.body.tracks.items[0].uri;
        }
        
        return null;
    } catch (error) {
        console.error("Erreur lors de la recherche Spotify:", error);
        return null;
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
