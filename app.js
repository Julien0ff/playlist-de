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

// ── Backend Render (rate-limit + Spotify) ────────────
const BACKEND_URL = 'https://playlist-de.onrender.com/api/suggest';

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

// ── Suggest Track → POST to Render backend ───────────
async function suggestTrack(btnElement, trackName, artistName, albumName) {
    // Hide any previous rate-limit banner
    rateLimitBanner.classList.remove('visible');

    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnElement.classList.add('loading');
    btnElement.disabled = true;

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackName, artistName, albumName })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // ✅ Success
            btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Ajouté';
            btnElement.classList.remove('loading');
            btnElement.classList.add('success');
            showToast();

        } else if (response.status === 429) {
            // ⏳ Rate limited
            btnElement.innerHTML = '<i class="fa-solid fa-clock"></i> Limite';
            btnElement.classList.remove('loading');
            btnElement.classList.add('error');

            rateLimitMsg.textContent = result.message || `Limite atteinte. Réessaie dans ${result.remainingMin || '?'} min.`;
            rateLimitBanner.classList.add('visible');

            // Re-enable after a moment
            setTimeout(() => {
                btnElement.innerHTML = originalHTML;
                btnElement.classList.remove('error');
                btnElement.disabled = false;
            }, 5000);

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
