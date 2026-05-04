// ══════════════════════════════════════════════════════
// Suggestify — App Logic (Apple Music Edition)
// ══════════════════════════════════════════════════════

const searchInput   = document.getElementById('searchInput');
const searchLoader  = document.getElementById('searchLoader');
const clearBtn      = document.getElementById('clearBtn');
const resultsContainer = document.getElementById('resultsContainer');
const toast         = document.getElementById('toast');
const rateLimitBanner  = document.getElementById('rateLimitBanner');
const rateLimitMsg     = document.getElementById('rateLimitMsg');
const quotaStatus      = document.getElementById('quotaStatus');

// ── Google Apps Script (suggestion → Google Sheet) ───
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz-QIswEWuQP7mqk0ZawZWxyzKClWuB3Wdolky3YoQsJaxTdW3LB80gg7czI3fJQ2XGlg/exec';

// ── Rate Limit côté client (2 musiques / 15 min) ─────
const RATE_LIMIT_MAX = 2;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_KEY = 'suggestify_timestamps';

function getRateLimitTimestamps() {
    try {
        const raw = localStorage.getItem(RATE_LIMIT_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        const now = Date.now();
        // Ne garder que les timestamps récents (< 15 min)
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

function updateQuotaStatus() {
    const used = getRateLimitTimestamps().length;
    const remaining = Math.max(0, RATE_LIMIT_MAX - used);

    if (remaining === 2) {
        quotaStatus.innerHTML = `<div class="quota-badge ok"><i class="fa-solid fa-music"></i> ${remaining}/2 dispo</div>`;
        stopQuotaTimer();
    } else if (remaining === 1) {
        quotaStatus.innerHTML = `<div class="quota-badge warn"><i class="fa-solid fa-music"></i> ${remaining}/2 dispo</div>`;
        stopQuotaTimer();
    } else {
        // Cooldown — show remaining time
        const rateCheck = checkRateLimit();
        quotaStatus.innerHTML = `<div class="quota-badge limit"><i class="fa-solid fa-clock"></i> ${rateCheck.remainingMin} min</div>`;
        startQuotaTimer();
    }
}

function startQuotaTimer() {
    if (quotaInterval) return;
    quotaInterval = setInterval(() => {
        const used = getRateLimitTimestamps().length;
        const remaining = RATE_LIMIT_MAX - used;
        if (remaining > 0) {
            // Cooldown finished
            rateLimitBanner.classList.remove('visible');
            updateQuotaStatus();
        } else {
            updateQuotaStatus();
        }
    }, 10000); // refresh every 10s
}

function stopQuotaTimer() {
    if (quotaInterval) {
        clearInterval(quotaInterval);
        quotaInterval = null;
    }
}

// Init quota on page load
updateQuotaStatus();

let debounceTimeout = null;

// ── Search Input ─────────────────────────────────────
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    // Toggle clear button
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

// ── iTunes Search (no auth needed) ───────────────────
async function searchMusic(query) {
    showLoader();
    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`;
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

// ── Render Results ───────────────────────────────────
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
            <button class="add-btn" onclick="suggestTrack(this, '${escapeAttr(track.trackName)}', '${escapeAttr(track.artistName)}', '${escapeAttr(track.collectionName)}')">
                <i class="fa-solid fa-plus"></i> Ajouter
            </button>
        `;

        resultsContainer.appendChild(row);
    });
}

// ── Suggest Track → GET to Google Apps Script ────────
async function suggestTrack(btnElement, trackName, artistName, albumName) {
    // Hide any previous rate-limit banner
    rateLimitBanner.classList.remove('visible');

    // Vérifier le rate limit côté client
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

    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnElement.classList.add('loading');
    btnElement.disabled = true;

    try {
        const url = `${GOOGLE_SCRIPT_URL}?trackName=${encodeURIComponent(trackName)}&artistName=${encodeURIComponent(artistName)}&albumName=${encodeURIComponent(albumName)}`;
        const response = await fetch(url);
        const result = await response.json();

        if (response.ok && result.result === 'success') {
            // ✅ Success — enregistrer dans le rate limiter
            recordSuggestion();
            updateQuotaStatus();
            btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Ajouté';
            btnElement.classList.remove('loading');
            btnElement.classList.add('success');
            showToast();

        } else {
            // ❌ Other error
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

function showLoader()  { searchLoader.classList.add('active'); }
function hideLoader()  { searchLoader.classList.remove('active'); }

function showToast() {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
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
