// filter.js

// Liste basique de mots interdits (trolls et insultes fréquentes)
const BAD_WORDS = [
    // FR
    "con", "connard", "salope", "pute", "merde", "enculé", "encule", "fdp", "ntm", 
    "bite", "chatte", "couille", "bâtard", "batard",
    // EN
    "fuck", "bitch", "shit", "asshole", "cunt", "dick", "pussy", "slut", "whore",
    // TROLL / SPAM
    "gémissement", "moan", "earrape", "rickroll", "troll"
];

/**
 * Vérifie si une chaîne de texte contient un mot interdit.
 * @param {string} text Le texte à vérifier
 * @returns {boolean} true si le texte contient un mot interdit, false sinon
 */
function containsBadWords(text) {
    if (!text) return false;
    
    // Convertir en minuscules et retirer les accents
    const normalizedText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Vérification
    return BAD_WORDS.some(word => {
        // On utilise une expression régulière pour chercher le mot exact (éviter les faux positifs)
        // \b indique les "frontières" d'un mot
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(normalizedText);
    });
}

/**
 * Vérifie si la suggestion est valide (pas d'insultes ni de trolls)
 * @param {string} trackName Titre de la musique
 * @param {string} artistName Nom de l'artiste
 * @returns {Object} { isValid: boolean, reason: string|null }
 */
function validateSuggestion(trackName, artistName) {
    if (containsBadWords(trackName)) {
        return { isValid: false, reason: "Le titre contient un langage inapproprié." };
    }
    
    if (containsBadWords(artistName)) {
        return { isValid: false, reason: "Le nom de l'artiste contient un langage inapproprié." };
    }
    
    // Vous pouvez ajouter d'autres règles ici à l'avenir (ex: bloquer un artiste précis)
    if (artistName.toLowerCase().includes("rick astley")) {
        return { isValid: false, reason: "Rickroll détecté !" };
    }

    return { isValid: true, reason: null };
}

module.exports = { validateSuggestion };
