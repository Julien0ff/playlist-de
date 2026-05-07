// ══════════════════════════════════════════════════════
// Suggestify — Admin Dashboard Logic
// ══════════════════════════════════════════════════════

const API = window.location.origin;
let TOKEN = localStorage.getItem('suggestify_admin_token') || null;
let sessions = [];
let editingSessionId = null;

// ── DOM ──────────────────────────────────────────────
const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const sessionsGrid = document.getElementById('sessionsGrid');
const sessionSelect = document.getElementById('sessionSelect');
const suggestionsContent = document.getElementById('suggestionsContent');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalConfirm = document.getElementById('modalConfirm');
const adminToast = document.getElementById('adminToast');
const adminToastMsg = document.getElementById('adminToastMsg');

// ══════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════

async function tryAutoLogin() {
    if (!TOKEN) return showLogin();
    try {
        const res = await fetch(`${API}/api/admin/sessions`, { headers: authHeaders() });
        if (res.ok) return showDashboard();
    } catch {}
    TOKEN = null;
    localStorage.removeItem('suggestify_admin_token');
    showLogin();
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.remove('visible');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const res = await fetch(`${API}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: loginPassword.value })
        });
        const data = await res.json();

        if (data.success) {
            TOKEN = data.token;
            localStorage.setItem('suggestify_admin_token', TOKEN);
            showDashboard();
        } else {
            loginError.classList.add('visible');
        }
    } catch {
        loginError.textContent = 'Erreur de connexion.';
        loginError.classList.add('visible');
    }

    loginBtn.disabled = false;
    loginBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Connexion';
});

logoutBtn.addEventListener('click', () => {
    TOKEN = null;
    localStorage.removeItem('suggestify_admin_token');
    showLogin();
});

function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboard.style.display = 'none';
    loginPassword.value = '';
    loginPassword.focus();
}

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboard.style.display = 'block';
    loadSessions();
}

function authHeaders() {
    return { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
}

// ══════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

        if (btn.dataset.tab === 'suggestions') refreshSessionSelect();
    });
});

// ══════════════════════════════════════════════════════
// SESSIONS
// ══════════════════════════════════════════════════════

async function loadSessions() {
    try {
        const res = await fetch(`${API}/api/admin/sessions`, { headers: authHeaders() });
        const data = await res.json();
        if (!data.success) return;
        sessions = data.sessions;
        renderSessions();
    } catch (err) {
        console.error('Erreur chargement sessions:', err);
    }
}

function renderSessions() {
    if (sessions.length === 0) {
        sessionsGrid.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-calendar-plus"></i><p>Aucune session créée. Clique sur "Nouvelle session" pour commencer.</p></div>`;
        return;
    }

    // Sort: active first, then upcoming, then ended
    const order = { active: 0, upcoming: 1, ended: 2 };
    const sorted = [...sessions].sort((a, b) => (order[a.status] || 2) - (order[b.status] || 2));

    sessionsGrid.innerHTML = sorted.map(s => {
        const statusLabel = { active: 'Active', upcoming: 'À venir', ended: 'Terminée' }[s.status] || s.status;
        const formatD = d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        const sessionUrl = `${window.location.origin}/session/${s.slug}`;

        return `
        <div class="session-card" data-id="${s.id}">
            <div class="session-status-dot ${s.status}"></div>
            <div class="session-info">
                <div class="session-title">${esc(s.title)}</div>
                <div class="session-dates">${formatD(s.dateStart)} → ${formatD(s.dateEnd)}</div>
            </div>
            <span class="session-badge ${s.status}">${statusLabel}</span>
            <span class="session-count"><i class="fa-solid fa-music"></i> ${s.suggestionCount || 0}</span>
            <div class="session-actions">
                <button class="session-link-btn" title="Copier le lien public" onclick="copyText('${sessionUrl}', 'Lien copié !')"><i class="fa-solid fa-link"></i></button>
                <button class="action-btn" title="Modifier" onclick="openEditSession('${s.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="action-btn danger" title="Supprimer" onclick="deleteSession('${s.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

// ── Modal ────────────────────────────────────────────

document.getElementById('newSessionBtn').addEventListener('click', () => {
    editingSessionId = null;
    modalTitle.textContent = 'Nouvelle session';
    modalConfirm.textContent = 'Créer';
    document.getElementById('modalSessionTitle').value = '';
    document.getElementById('modalDateStart').value = '';
    document.getElementById('modalDateEnd').value = '';
    modalOverlay.classList.add('active');
});

document.getElementById('modalCancel').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

function closeModal() { modalOverlay.classList.remove('active'); }

function openEditSession(id) {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    editingSessionId = id;
    modalTitle.textContent = 'Modifier la session';
    modalConfirm.textContent = 'Enregistrer';
    document.getElementById('modalSessionTitle').value = s.title;
    document.getElementById('modalDateStart').value = s.dateStart;
    document.getElementById('modalDateEnd').value = s.dateEnd;
    modalOverlay.classList.add('active');
}

modalConfirm.addEventListener('click', async () => {
    const title = document.getElementById('modalSessionTitle').value.trim();
    const dateStart = document.getElementById('modalDateStart').value;
    const dateEnd = document.getElementById('modalDateEnd').value;

    if (!title || !dateStart || !dateEnd) return;

    try {
        if (editingSessionId) {
            await fetch(`${API}/api/admin/sessions/${editingSessionId}`, {
                method: 'PUT', headers: authHeaders(),
                body: JSON.stringify({ title, dateStart, dateEnd })
            });
            toast('Session modifiée !');
        } else {
            const res = await fetch(`${API}/api/admin/sessions`, {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({ title, dateStart, dateEnd })
            });
            const data = await res.json();
            if (!data.success) { alert(data.message); return; }
            toast('Session créée !');
        }
        closeModal();
        loadSessions();
    } catch (err) {
        console.error(err);
        alert('Erreur lors de la sauvegarde.');
    }
});

async function deleteSession(id) {
    const s = sessions.find(x => x.id === id);
    if (!confirm(`Supprimer la session "${s?.title}" et toutes ses suggestions ?`)) return;

    try {
        await fetch(`${API}/api/admin/sessions/${id}`, { method: 'DELETE', headers: authHeaders() });
        toast('Session supprimée.');
        loadSessions();
    } catch (err) {
        console.error(err);
    }
}

// ══════════════════════════════════════════════════════
// SUGGESTIONS
// ══════════════════════════════════════════════════════

function refreshSessionSelect() {
    sessionSelect.innerHTML = '<option value="">— Sélectionner une session —</option>';
    sessions.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.title} (${s.suggestionCount || 0})`;
        sessionSelect.appendChild(opt);
    });
}

sessionSelect.addEventListener('change', () => {
    if (sessionSelect.value) loadSuggestions(sessionSelect.value);
    else suggestionsContent.innerHTML = '';
});

async function loadSuggestions(sessionId) {
    try {
        const res = await fetch(`${API}/api/admin/sessions/${sessionId}/suggestions`, { headers: authHeaders() });
        const data = await res.json();
        if (!data.success) return;
        renderSuggestions(data.suggestions);
    } catch (err) {
        console.error(err);
    }
}

function renderSuggestions(suggestions) {
    if (suggestions.length === 0) {
        suggestionsContent.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-inbox"></i><p>Aucune suggestion pour cette session.</p></div>`;
        return;
    }

    const pending = suggestions.filter(s => s.status === 'pending');
    const accepted = suggestions.filter(s => s.status === 'accepted');
    const done = suggestions.filter(s => s.status === 'done');

    let html = '';

    if (pending.length) {
        html += renderGroup('En attente', pending, 'pending');
    }
    if (accepted.length) {
        html += renderGroup('Acceptées', accepted, 'accepted');
    }
    if (done.length) {
        html += renderGroup('Ajoutées à la playlist', done, 'done');
    }

    suggestionsContent.innerHTML = html;
}

function renderGroup(title, items, type) {
    const rows = items.map(s => {
        const artwork = s.artworkUrl || '';
        const artworkTag = artwork
            ? `<img src="${esc(artwork)}" class="suggestion-artwork" loading="lazy">`
            : `<div class="suggestion-artwork" style="display:grid;place-items:center;font-size:18px;color:var(--text-tertiary)"><i class="fa-solid fa-music"></i></div>`;

        const time = timeAgo(s.createdAt);
        let actions = '';

        if (type === 'pending') {
            actions = `
                <button class="sug-btn accept" onclick="acceptSuggestion('${s.id}')"><i class="fa-solid fa-check"></i> Accepter</button>
                <button class="sug-btn reject" onclick="rejectSuggestion('${s.id}', this)"><i class="fa-solid fa-xmark"></i> Refuser</button>
            `;
        } else if (type === 'accepted') {
            actions = `
                <button class="sug-btn copy" onclick="copySuggestionTitle('${esc(s.artistName)} - ${esc(s.trackName)}', this)"><i class="fa-solid fa-copy"></i> Titre</button>
                <button class="sug-btn copy" onclick="copySuggestionSearch('${esc(s.trackName)} ${esc(s.artistName)}', this)"><i class="fa-solid fa-magnifying-glass"></i> Recherche</button>
                <button class="sug-btn done" onclick="markDone('${s.id}')"><i class="fa-solid fa-check-double"></i> Fait</button>
            `;
        } else {
            actions = `<span style="font-size:12px;color:var(--success);display:flex;align-items:center;gap:4px"><i class="fa-solid fa-circle-check"></i> Ajoutée</span>`;
        }

        return `
        <div class="suggestion-row ${type === 'done' ? 'is-done' : ''}" id="sug-${s.id}">
            ${artworkTag}
            <div class="suggestion-meta">
                <div class="suggestion-name">${esc(s.trackName)}</div>
                <div class="suggestion-artist">${esc(s.artistName)}${s.albumName ? ' — ' + esc(s.albumName) : ''}</div>
                <div class="suggestion-time">${time}</div>
            </div>
            <div class="suggestion-actions">${actions}</div>
        </div>`;
    }).join('');

    return `
    <div class="suggestion-group">
        <div class="suggestion-group-title">
            ${title} <span class="count">${items.length}</span>
        </div>
        ${rows}
    </div>`;
}

// ── Suggestion Actions ───────────────────────────────

async function acceptSuggestion(id) {
    try {
        await fetch(`${API}/api/admin/suggestions/${id}/accept`, { method: 'PUT', headers: authHeaders() });
        toast('Suggestion acceptée !');
        loadSuggestions(sessionSelect.value);
        loadSessions(); // refresh count
    } catch (err) { console.error(err); }
}

async function rejectSuggestion(id, btnEl) {
    const row = document.getElementById(`sug-${id}`);
    if (row) {
        row.classList.add('removing');
        await new Promise(r => setTimeout(r, 400));
    }

    try {
        await fetch(`${API}/api/admin/suggestions/${id}/reject`, { method: 'PUT', headers: authHeaders() });
        toast('Suggestion refusée.');
        loadSuggestions(sessionSelect.value);
        loadSessions();
    } catch (err) { console.error(err); }
}

async function markDone(id) {
    try {
        await fetch(`${API}/api/admin/suggestions/${id}/done`, { method: 'PUT', headers: authHeaders() });
        toast('Marquée comme ajoutée !');
        loadSuggestions(sessionSelect.value);
    } catch (err) { console.error(err); }
}

function copySuggestionTitle(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copié';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="fa-solid fa-copy"></i> Titre';
        }, 2000);
    });
}

function copySuggestionSearch(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copié';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Recherche';
        }, 2000);
    });
}

// ══════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════

function copyText(text, msg) {
    navigator.clipboard.writeText(text).then(() => toast(msg || 'Copié !'));
}

function toast(msg) {
    adminToastMsg.textContent = msg;
    adminToast.classList.add('show');
    setTimeout(() => adminToast.classList.remove('show'), 3000);
}

function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'À l\'instant';
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
}

// ── Init ─────────────────────────────────────────────
tryAutoLogin();
