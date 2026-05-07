// ══════════════════════════════════════════════════════
// Suggestify — App Logic (Session-Based Edition)
// ══════════════════════════════════════════════════════

// ── Get session slug from URL ────────────────────────
const pathParts = window.location.pathname.split('/');
const SESSION_SLUG = pathParts[pathParts.indexOf('session') + 1] || null;

// ── DOM elements ─────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const searchLoader = document.getElementById('searchLoader');
const clearBtn = document.getElementById('clearBtn');
const resultsContainer = document.getElementById('resultsContainer');
const toast = document.getElementById('toast');
const rateLimitBanner = document.getElementById('rateLimitBanner');
const rateLimitMsg = document.getElementById('rateLimitMsg');
const quotaStatus = document.getElementById('quotaStatus');
const sessionLabel = document.getElementById('sessionLabel');
const sessionStatusScreen = document.getElementById('sessionStatusScreen');
const activeSessionContent = document.getElementById('activeSessionContent');
const sessionAuthScreen = document.getElementById('sessionAuthScreen');
const sessionAuthForm = document.getElementById('sessionAuthForm');
const sessionPasswordInput = document.getElementById('sessionPasswordInput');
const sessionAuthError = document.getElementById('sessionAuthError');
const sessionAuthBtn = document.getElementById('sessionAuthBtn');

let currentSession = null;

// ── API Base URL ─────────────────────────────────────
const API_BASE = window.location.origin;

// ── Rate Limit côté client (2 musiques / 15 min) ─────
const RATE_LIMIT_MAX = 2;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_KEY = `suggestify_ts_${SESSION_SLUG}`;

function getRateLimitTimestamps() {
    try {
        const raw = localStorage.getItem(RATE_LIMIT_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        const now = Date.now();
        return arr.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    } catch { return []; }
}

function checkRateLimit() {
    const timestamps = getRateLimitTimestamps();
    if (timestamps.length >= RATE_LIMIT_MAX) {
        const oldest = timestamps[0];
        const remainingMs = RATE_LIMIT_WINDOW_MS - (Date.now() - oldest);
        const remainingMin = Math.ceil(remainingMs / 60000);
        return { allowed: false, remainingMin };
    }
    return { allowed: true, remainingMin: 0 };
}

function recordSuggestion() {
    const timestamps = getRateLimitTimestamps();
    timestamps.push(Date.now());
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(timestamps));
}

// ── Quota Status Badge ───────────────────────────────
let quotaInterval = null;
const TOOLTIP_TEXT = 'Tu peux suggérer <strong>2 musiques</strong> toutes les <strong>15 minutes</strong> pour garder la playlist variée.';

function updateQuotaStatus() {
    const used = getRateLimitTimestamps().length;
    const remaining = Math.max(0, RATE_LIMIT_MAX - used);
    const tooltip = `<div class="quota-tooltip" id="quotaTooltip">${TOOLTIP_TEXT}</div>`;

    if (remaining === 2) {
        quotaStatus.innerHTML = `<div class="quota-badge ok"><i class="fa-solid fa-music"></i> ${remaining}/2 dispo</div>${tooltip}`;
        stopQuotaTimer();
    } else if (remaining === 1) {
        quotaStatus.innerHTML = `<div class="quota-badge warn"><i class="fa-solid fa-music"></i> ${remaining}/2 dispo</div>${tooltip}`;
        stopQuotaTimer();
    } else {
        const rateCheck = checkRateLimit();
        quotaStatus.innerHTML = `<div class="quota-badge limit"><i class="fa-solid fa-clock"></i> ${rateCheck.remainingMin} min</div>${tooltip}`;
        startQuotaTimer();
    }
}

function startQuotaTimer() {
    if (quotaInterval) return;
    quotaInterval = setInterval(() => {
        const used = getRateLimitTimestamps().length;
        const remaining = RATE_LIMIT_MAX - used;
        if (remaining > 0) {
            rateLimitBanner.classList.remove('visible');
        }
        updateQuotaStatus();
    }, 10000);
}

function stopQuotaTimer() {
    if (quotaInterval) {
        clearInterval(quotaInterval);
        quotaInterval = null;
    }
}

// Mobile: tap badge to toggle tooltip
quotaStatus.addEventListener('click', (e) => {
    e.stopPropagation();
    const tip = document.getElementById('quotaTooltip');
    if (tip) tip.classList.toggle('show');
});

document.addEventListener('click', () => {
    const tip = document.getElementById('quotaTooltip');
    if (tip) tip.classList.remove('show');
});

// ══════════════════════════════════════════════════════
// SESSION LOADING
// ══════════════════════════════════════════════════════

async function loadSession() {
    if (!SESSION_SLUG) {
        showSessionError('Page introuvable', 'Aucune session spécifiée dans l\'URL.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/public?slug=${SESSION_SLUG}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
            showSessionError('Session introuvable', `La session "${SESSION_SLUG}" n'existe pas.`);
            return;
        }

        const session = data.session;
        currentSession = session;
        document.title = `Suggestify — ${session.title}`;
        sessionLabel.textContent = session.title;

        if (data.requireAuth) {
            const savedPwd = sessionStorage.getItem(`suggestify_pwd_${SESSION_SLUG}`);
            if (savedPwd) {
                const ok = await verifyPassword(savedPwd);
                if (ok) {
                    processSessionStatus(session);
                    return;
                }
            }
            showAuthScreen();
            return;
        }

        processSessionStatus(session);
    } catch (err) {
        console.error('Erreur chargement session:', err);
        showSessionError('Erreur', 'Impossible de charger la session. Vérifie ta connexion.');
    }
}

function processSessionStatus(session) {
    if (sessionAuthScreen) sessionAuthScreen.style.display = 'none';
    if (session.status === 'active') {
        sessionStatusScreen.style.display = 'none';
        activeSessionContent.style.display = 'block';
        const rightBar = document.querySelector('.top-bar-right');
        if (rightBar) rightBar.style.display = 'flex';
        updateQuotaStatus();
    } else if (session.status === 'upcoming') {
        showSessionStatus('upcoming', session.title, `La session "${session.title}" n'a pas encore commencé.`, session.dateStart, session.timeStart, session.dateEnd, session.timeEnd);
    } else {
        showSessionStatus('ended', session.title, `La session "${session.title}" est terminée.`, session.dateStart, session.timeStart, session.dateEnd, session.timeEnd);
    }
}

function showAuthScreen() {
    activeSessionContent.style.display = 'none';
    sessionStatusScreen.style.display = 'none';
    if (sessionAuthScreen) sessionAuthScreen.style.display = 'flex';
    const rightBar = document.querySelector('.top-bar-right');
    if (rightBar) rightBar.style.display = 'none';
}

if (sessionAuthForm) {
    sessionAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = sessionPasswordInput.value.trim();
        if (!pwd) return;

        sessionAuthBtn.disabled = true;
        sessionAuthBtn.style.opacity = '0.7';
        if (sessionAuthError) sessionAuthError.style.display = 'none';

        const ok = await verifyPassword(pwd);
        
        sessionAuthBtn.disabled = false;
        sessionAuthBtn.style.opacity = '1';

        if (ok) {
            sessionStorage.setItem(`suggestify_pwd_${SESSION_SLUG}`, pwd);
            processSessionStatus(currentSession);
        } else {
            if (sessionAuthError) sessionAuthError.style.display = 'block';
        }
    });
}

async function verifyPassword(pwd) {
    try {
        const res = await fetch(`${API_BASE}/api/public?slug=${SESSION_SLUG}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verifyPassword', password: pwd })
        });
        const data = await res.json();
        return data.success;
    } catch {
        return false;
    }
}

function showSessionStatus(type, title, message, dateStart, timeStart, dateEnd, timeEnd) {
    activeSessionContent.style.display = 'none';
    sessionStatusScreen.style.display = 'flex';
    const rightBar = document.querySelector('.top-bar-right');
    if (rightBar) rightBar.style.display = 'none';

    const icon = document.getElementById('sessionStatusIcon');
    const titleEl = document.getElementById('sessionStatusTitle');
    const msgEl = document.getElementById('sessionStatusMsg');
    const datesEl = document.getElementById('sessionStatusDates');

    if (type === 'upcoming') {
        icon.innerHTML = '<i class="fa-solid fa-hourglass-start"></i>';
        icon.className = 'session-status-icon upcoming';
    } else {
        icon.innerHTML = '<i class="fa-solid fa-flag-checkered"></i>';
        icon.className = 'session-status-icon ended';
    }

    titleEl.textContent = title;
    msgEl.textContent = message;

    const formatDT = (d, t) => {
        const date = new Date(`${d}T${t || '00:00'}:00`);
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' à ' + (t || '00:00');
    };

    datesEl.innerHTML = `<i class="fa-regular fa-calendar"></i> ${formatDT(dateStart, timeStart)} — ${formatDT(dateEnd, timeEnd)}`;
}

function showSessionError(title, message) {
    activeSessionContent.style.display = 'none';
    sessionStatusScreen.style.display = 'flex';
    document.querySelector('.top-bar-right').style.display = 'none';

    const icon = document.getElementById('sessionStatusIcon');
    icon.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
    icon.className = 'session-status-icon error';

    document.getElementById('sessionStatusTitle').textContent = title;
    document.getElementById('sessionStatusMsg').textContent = message;
    document.getElementById('sessionStatusDates').innerHTML = '';
}

// ══════════════════════════════════════════════════════
// SEARCH & SUGGEST
// ══════════════════════════════════════════════════════

let debounceTimeout = null;

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearBtn.classList.toggle('visible', query.length > 0);
    clearTimeout(debounceTimeout);

    if (query.length < 2) {
        showEmptyState();
        return;
    }
    debounceTimeout = setTimeout(() => searchMusic(query), 400);
});

clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.remove('visible');
    showEmptyState();
    searchInput.focus();
});

// iTunes Search
async function searchMusic(query) {
    showLoader();
    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25`;
        const response = await fetch(url);
        const data = await response.json();
        displayResults(data.results);
    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-wrap">
                    <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger)"></i>
                </div>
                <p>Erreur lors de la recherche. Vérifie ta connexion.</p>
            </div>
        `;
    } finally {
        hideLoader();
    }
}

function displayResults(tracks) {
    if (!tracks || tracks.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-wrap">
                    <i class="fa-regular fa-face-frown"></i>
                </div>
                <p>Aucun résultat trouvé.</p>
            </div>
        `;
        return;
    }

    resultsContainer.innerHTML = '';

    tracks.forEach((track, index) => {
        const coverUrl = track.artworkUrl100.replace('100x100bb', '300x300bb');
        const row = document.createElement('div');
        row.className = 'track-row';
        row.style.animation = `rowAppear 0.35s cubic-bezier(0.22,1,0.36,1) ${index * 0.06}s backwards`;

        row.innerHTML = `
            <img src="${coverUrl}" alt="${escapeAttr(track.collectionName)}" class="track-artwork" loading="lazy">
            <div class="track-meta">
                <span class="track-name">${escapeHtml(track.trackName)}</span>
                <span class="track-artist">${escapeHtml(track.artistName)} — ${escapeHtml(track.collectionName)}</span>
            </div>
            <button class="add-btn" data-track='${escapeAttr(JSON.stringify({
                trackName: track.trackName,
                artistName: track.artistName,
                albumName: track.collectionName,
                artworkUrl: coverUrl,
                previewUrl: track.previewUrl || ''
            }))}'>
                <i class="fa-solid fa-plus"></i> Ajouter
            </button>
        `;

        // Attach click handler
        const btn = row.querySelector('.add-btn');
        btn.addEventListener('click', () => suggestTrack(btn));

        resultsContainer.appendChild(row);
    });
}

// Suggest Track → POST to backend API
async function suggestTrack(btnElement) {
    rateLimitBanner.classList.remove('visible');

    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
        rateLimitMsg.textContent = `Tu as déjà suggéré 2 musiques. Réessaie dans ${rateCheck.remainingMin} min.`;
        rateLimitBanner.classList.add('visible');
        btnElement.innerHTML = '<i class="fa-solid fa-clock"></i> Limite';
        btnElement.classList.add('error');
        btnElement.disabled = true;
        setTimeout(() => {
            btnElement.innerHTML = '<i class="fa-solid fa-plus"></i> Ajouter';
            btnElement.classList.remove('error');
            btnElement.disabled = false;
        }, 5000);
        return;
    }

    const trackData = JSON.parse(btnElement.dataset.track);
    const savedPwd = sessionStorage.getItem(`suggestify_pwd_${SESSION_SLUG}`);
    if (savedPwd) trackData.password = savedPwd;

    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnElement.classList.add('loading');
    btnElement.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/api/public?slug=${SESSION_SLUG}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trackData)
        });
        const result = await response.json();

        if (response.ok && result.success) {
            recordSuggestion();
            updateQuotaStatus();
            btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Envoyé';
            btnElement.classList.remove('loading');
            btnElement.classList.add('success');
            showToast('Suggestion envoyée !');
        } else if (result.duplicate) {
            // Doublon détecté
            btnElement.innerHTML = '<i class="fa-solid fa-clone"></i> Déjà proposée';
            btnElement.classList.remove('loading');
            btnElement.classList.add('duplicate');
            showToast(result.message || 'Cette musique a déjà été proposée !', 'duplicate');
            setTimeout(() => {
                btnElement.innerHTML = originalHTML;
                btnElement.classList.remove('duplicate');
                btnElement.disabled = false;
            }, 4000);
        } else {
            btnElement.innerHTML = '<i class="fa-solid fa-xmark"></i> Erreur';
            btnElement.classList.remove('loading');
            btnElement.classList.add('error');
            console.error('Erreur:', result);
            setTimeout(() => {
                btnElement.innerHTML = originalHTML;
                btnElement.classList.remove('error');
                btnElement.disabled = false;
            }, 3000);
        }
    } catch (error) {
        console.error('Erreur réseau:', error);
        btnElement.innerHTML = '<i class="fa-solid fa-wifi"></i> Hors ligne';
        btnElement.classList.remove('loading');
        btnElement.classList.add('error');
        setTimeout(() => {
            btnElement.innerHTML = originalHTML;
            btnElement.classList.remove('error');
            btnElement.disabled = false;
        }, 3000);
    }
}

// ── Utilities ────────────────────────────────────────
function showEmptyState() {
    resultsContainer.innerHTML = `
        <div class="empty-state" id="emptyState">
            <div class="empty-icon-wrap">
                <i class="fa-solid fa-headphones"></i>
            </div>
            <p>Recherche un titre pour commencer</p>
        </div>
    `;
}

function showLoader() { searchLoader.classList.add('active'); }
function hideLoader() { searchLoader.classList.remove('active'); }

function showToast(message, type) {
    const toastIcon = toast.querySelector('.toast-icon');
    const toastText = toast.querySelector('span');

    if (type === 'duplicate') {
        toastIcon.style.background = 'var(--warning)';
        toastIcon.innerHTML = '<i class="fa-solid fa-clone"></i>';
    } else {
        toastIcon.style.background = 'var(--success)';
        toastIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
    }

    toastText.textContent = message || 'Suggestion envoyée !';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\\/g, '\\\\');
}

// ── Init ─────────────────────────────────────────────
loadSession();
