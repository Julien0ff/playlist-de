// api/filter.js

const BAD_WORDS = [
    // FR
    "con", "connard", "salope", "pute", "merde", "enculé", "encule", "fdp", "ntm", 
    "bite", "chatte", "couille", "bâtard", "batard",
    // EN
    "fuck", "bitch", "shit", "asshole", "cunt", "dick", "pussy", "slut", "whore",
    // TROLL / SPAM
    "gémissement", "moan", "earrape", "rickroll", "troll"
];

function containsBadWords(text) {
    if (!text) return false;
    const normalizedText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    return BAD_WORDS.some(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(normalizedText);
    });
}

function validateSuggestion(trackName, artistName) {
    if (containsBadWords(trackName)) {
        return { isValid: false, reason: "Le titre contient un langage inapproprié." };
    }
    
    if (containsBadWords(artistName)) {
        return { isValid: false, reason: "Le nom de l'artiste contient un langage inapproprié." };
    }
    
    if (artistName.toLowerCase().includes("rick astley")) {
        return { isValid: false, reason: "Rickroll détecté !" };
    }

    return { isValid: true, reason: null };
}

module.exports = { validateSuggestion };
