const searchInput = document.getElementById('searchInput');
const searchLoader = document.getElementById('searchLoader');
const resultsContainer = document.getElementById('resultsContainer');
const toast = document.getElementById('toast');

// Remplacez cette URL par l'URL de votre Google Apps Script Web App une fois déployée
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz-QIswEWuQP7mqk0ZawZWxyzKClWuB3Wdolky3YoQsJaxTdW3LB80gg7czI3fJQ2XGlg/exec';

let debounceTimeout = null;

// Écouteur d'événement pour la barre de recherche
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    clearTimeout(debounceTimeout);

    if (query.length < 2) {
        showEmptyState();
        return;
    }

    // Debounce de 500ms
    debounceTimeout = setTimeout(() => {
        searchMusic(query);
    }, 500);
});

// Rechercher de la musique via l'API iTunes (Sans authentification requise)
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
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger)"></i>
                <p>Une erreur est survenue lors de la recherche.</p>
            </div>
        `;
    } finally {
        hideLoader();
    }
}

function displayResults(tracks) {
    if (tracks.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-face-frown"></i>
                <p>Aucun résultat trouvé pour cette recherche.</p>
            </div>
        `;
        return;
    }

    resultsContainer.innerHTML = '';

    tracks.forEach((track, index) => {
        // Obtenir une image de meilleure qualité
        const coverUrl = track.artworkUrl100.replace('100x100bb', '300x300bb');

        const card = document.createElement('div');
        card.className = 'track-card';
        card.style.animationDelay = `${index * 0.1}s`;
        card.style.animation = 'fadeInUp 0.5s ease-out backwards';

        card.innerHTML = `
            <img src="${coverUrl}" alt="${track.collectionName}" class="track-cover">
            <div class="track-info">
                <div class="track-title" title="${track.trackName}">${track.trackName}</div>
                <div class="track-artist" title="${track.artistName}">${track.artistName} • ${track.collectionName}</div>
            </div>
            <button class="suggest-btn" onclick="suggestTrack(this, '${escapeHtml(track.trackName)}', '${escapeHtml(track.artistName)}', '${escapeHtml(track.collectionName)}')">
                <i class="fa-solid fa-paper-plane"></i> Suggérer
            </button>
        `;

        resultsContainer.appendChild(card);
    });
}

// Fonction pour envoyer la suggestion vers Google Sheets
async function suggestTrack(btnElement, trackName, artistName, albumName) {
    // Désactiver le bouton pendant l'envoi
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi...';
    btnElement.disabled = true;

    try {
        // Préparer les paramètres pour l'URL
        const params = new URLSearchParams({
            trackName: trackName,
            artistName: artistName,
            albumName: albumName
        });

        // Si l'URL n'est pas configurée, on simule l'envoi
        if (GOOGLE_SCRIPT_URL === 'VOTRE_URL_GOOGLE_APPS_SCRIPT_ICI') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.warn("⚠️ URL Google Apps Script non configurée. Envoi simulé !");
        } else {
            // Envoi réel vers Google Sheets
            await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`, {
                method: 'GET',
                mode: 'no-cors' // Évite les problèmes de CORS avec Google Apps Script
            });
        }

        // Succès
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Envoyé';
        btnElement.style.background = 'var(--success)';
        showToast();

    } catch (error) {
        console.error('Erreur lors de l\'envoi:', error);
        btnElement.innerHTML = '<i class="fa-solid fa-xmark"></i> Erreur';
        btnElement.style.background = 'var(--danger)';
        setTimeout(() => {
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
            btnElement.style.background = '';
        }, 3000);
    }
}

// Utilitaires
function showEmptyState() {
    resultsContainer.innerHTML = `
        <div class="empty-state" id="emptyState">
            <i class="fa-solid fa-music"></i>
            <p>Vos résultats de recherche s'afficheront ici</p>
        </div>
    `;
}

function showLoader() {
    searchLoader.classList.add('active');
}

function hideLoader() {
    searchLoader.classList.remove('active');
}

function showToast() {
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
