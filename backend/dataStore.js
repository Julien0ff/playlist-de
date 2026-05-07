// ══════════════════════════════════════════════════════
// Suggestify — JSON Data Store Helper
// ══════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(filename) {
    return path.join(DATA_DIR, filename);
}

function readJSON(filename) {
    const filePath = getFilePath(filename);
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '[]', 'utf-8');
            return [];
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error(`❌ Erreur lecture ${filename}:`, err.message);
        return [];
    }
}

function writeJSON(filename, data) {
    const filePath = getFilePath(filename);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error(`❌ Erreur écriture ${filename}:`, err.message);
    }
}

// ── Sessions ─────────────────────────────────────────

function getSessions() {
    return readJSON('sessions.json');
}

function getSessionBySlug(slug) {
    const sessions = getSessions();
    return sessions.find(s => s.slug === slug) || null;
}

function getSessionById(id) {
    const sessions = getSessions();
    return sessions.find(s => s.id === id) || null;
}

function createSession({ title, slug, dateStart, dateEnd }) {
    const sessions = getSessions();
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
    writeJSON('sessions.json', sessions);
    return session;
}

function updateSession(id, updates) {
    const sessions = getSessions();
    const idx = sessions.findIndex(s => s.id === id);
    if (idx === -1) return null;
    sessions[idx] = { ...sessions[idx], ...updates };
    writeJSON('sessions.json', sessions);
    return sessions[idx];
}

function deleteSession(id) {
    let sessions = getSessions();
    const before = sessions.length;
    sessions = sessions.filter(s => s.id !== id);
    writeJSON('sessions.json', sessions);
    // Also delete suggestions linked to this session
    let suggestions = getSuggestions();
    suggestions = suggestions.filter(s => s.sessionId !== id);
    writeJSON('suggestions.json', suggestions);
    return sessions.length < before;
}

// ── Suggestions ──────────────────────────────────────

function getSuggestions() {
    return readJSON('suggestions.json');
}

function getSuggestionsBySession(sessionId) {
    return getSuggestions().filter(s => s.sessionId === sessionId);
}

function createSuggestion({ sessionId, trackName, artistName, albumName, artworkUrl, previewUrl }) {
    const suggestions = getSuggestions();
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
    writeJSON('suggestions.json', suggestions);
    return suggestion;
}

function updateSuggestionStatus(id, status) {
    const suggestions = getSuggestions();
    const idx = suggestions.findIndex(s => s.id === id);
    if (idx === -1) return null;
    suggestions[idx].status = status;
    suggestions[idx].updatedAt = new Date().toISOString();
    writeJSON('suggestions.json', suggestions);
    return suggestions[idx];
}

function deleteSuggestion(id) {
    let suggestions = getSuggestions();
    suggestions = suggestions.filter(s => s.id !== id);
    writeJSON('suggestions.json', suggestions);
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
    getSessionStatus
};
