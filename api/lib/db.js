const Redis = require('ioredis');

// Utilise REDIS_URL ou KV_URL (pour être compatible avec les deux)
const redis = new Redis(process.env.REDIS_URL || process.env.KV_URL);

// ── Sessions ─────────────────────────────────────────

async function getSessions() {
    try {
        const raw = await redis.get('sessions');
        return raw ? JSON.parse(raw) : [];
    } catch (err) {
        console.error('❌ Erreur lecture sessions Redis:', err.message);
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
    await redis.set('sessions', JSON.stringify(sessions));
    return session;
}

async function updateSession(id, updates) {
    const sessions = await getSessions();
    const idx = sessions.findIndex(s => s.id === id);
    if (idx === -1) return null;
    sessions[idx] = { ...sessions[idx], ...updates };
    await redis.set('sessions', JSON.stringify(sessions));
    return sessions[idx];
}

async function deleteSession(id) {
    let sessions = await getSessions();
    const before = sessions.length;
    sessions = sessions.filter(s => s.id !== id);
    await redis.set('sessions', JSON.stringify(sessions));

    // Also delete suggestions linked to this session
    let suggestions = await getSuggestions();
    suggestions = suggestions.filter(s => s.sessionId !== id);
    await redis.set('suggestions', JSON.stringify(suggestions));

    return sessions.length < before;
}

// ── Suggestions ──────────────────────────────────────

async function getSuggestions() {
    try {
        const raw = await redis.get('suggestions');
        return raw ? JSON.parse(raw) : [];
    } catch (err) {
        console.error('❌ Erreur lecture suggestions Redis:', err.message);
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
    await redis.set('suggestions', JSON.stringify(suggestions));
    return suggestion;
}

async function updateSuggestionStatus(id, status) {
    const suggestions = await getSuggestions();
    const idx = suggestions.findIndex(s => s.id === id);
    if (idx === -1) return null;
    suggestions[idx].status = status;
    suggestions[idx].updatedAt = new Date().toISOString();
    await redis.set('suggestions', JSON.stringify(suggestions));
    return suggestions[idx];
}

async function deleteSuggestion(id) {
    let suggestions = await getSuggestions();
    suggestions = suggestions.filter(s => s.id !== id);
    await redis.set('suggestions', JSON.stringify(suggestions));
}

// ── Rate Limiting Helper (utilisé par public/suggest.js) ──

async function getRateLimit(key) {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
}

async function setRateLimit(key, value, expireMs) {
    await redis.set(key, JSON.stringify(value), 'PX', expireMs);
}

// ── Session Status Helper ────────────────────────────

function getSessionStatus(session) {
    const now = new Date();
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
    getRateLimit,
    setRateLimit,
    getSessionStatus
};
