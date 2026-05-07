const { kv } = require('@vercel/kv');

// ── Sessions ─────────────────────────────────────────

async function getSessions() {
    try {
        const sessions = await kv.get('sessions');
        return sessions || [];
    } catch (err) {
        console.error('❌ Erreur lecture sessions KV:', err.message);
        return [];
    }
}

async function getSessionBySlug(slug) {
    const sessions = await getSessions();
    return sessions.find(s => s.slug === slug) || null;
}

async function getSessionById(id) {
    const sessions = await getSessions();
    return sessions.find(s => s.id === id) || null;
}

async function createSession({ title, slug, dateStart, dateEnd }) {
    const sessions = await getSessions();
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const session = {
        id,
        title,
        slug,
        dateStart,
        dateEnd,
        createdAt: new Date().toISOString()
    };
    sessions.push(session);
    await kv.set('sessions', sessions);
    return session;
}

async function updateSession(id, updates) {
    const sessions = await getSessions();
    const idx = sessions.findIndex(s => s.id === id);
    if (idx === -1) return null;
    sessions[idx] = { ...sessions[idx], ...updates };
    await kv.set('sessions', sessions);
    return sessions[idx];
}

async function deleteSession(id) {
    let sessions = await getSessions();
    const before = sessions.length;
    sessions = sessions.filter(s => s.id !== id);
    await kv.set('sessions', sessions);

    // Also delete suggestions linked to this session
    let suggestions = await getSuggestions();
    suggestions = suggestions.filter(s => s.sessionId !== id);
    await kv.set('suggestions', suggestions);

    return sessions.length < before;
}

// ── Suggestions ──────────────────────────────────────

async function getSuggestions() {
    try {
        const suggestions = await kv.get('suggestions');
        return suggestions || [];
    } catch (err) {
        console.error('❌ Erreur lecture suggestions KV:', err.message);
        return [];
    }
}

async function getSuggestionsBySession(sessionId) {
    const suggestions = await getSuggestions();
    return suggestions.filter(s => s.sessionId === sessionId);
}

async function createSuggestion({ sessionId, trackName, artistName, albumName, artworkUrl, previewUrl }) {
    const suggestions = await getSuggestions();
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const suggestion = {
        id,
        sessionId,
        trackName,
        artistName,
        albumName,
        artworkUrl: artworkUrl || null,
        previewUrl: previewUrl || null,
        status: 'pending', // pending | accepted | done | rejected
        createdAt: new Date().toISOString()
    };
    suggestions.push(suggestion);
    await kv.set('suggestions', suggestions);
    return suggestion;
}

async function updateSuggestionStatus(id, status) {
    const suggestions = await getSuggestions();
    const idx = suggestions.findIndex(s => s.id === id);
    if (idx === -1) return null;
    suggestions[idx].status = status;
    suggestions[idx].updatedAt = new Date().toISOString();
    await kv.set('suggestions', suggestions);
    return suggestions[idx];
}

async function deleteSuggestion(id) {
    let suggestions = await getSuggestions();
    suggestions = suggestions.filter(s => s.id !== id);
    await kv.set('suggestions', suggestions);
}

// ── Session Status Helper ────────────────────────────

function getSessionStatus(session) {
    const now = new Date();
    // On force l'heure pour éviter les décalages de fuseau horaire
    const start = new Date(session.dateStart + 'T00:00:00');
    const end = new Date(session.dateEnd + 'T23:59:59');

    if (now < start) return 'upcoming';
    if (now > end) return 'ended';
    return 'active';
}

module.exports = {
    getSessions,
    getSessionBySlug,
    getSessionById,
    createSession,
    updateSession,
    deleteSession,
    getSuggestions,
    getSuggestionsBySession,
    createSuggestion,
    updateSuggestionStatus,
    deleteSuggestion,
    getSessionStatus
};
