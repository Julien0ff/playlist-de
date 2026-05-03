# 🚀 Configuration de Google Sheets pour Suggestify

Pour que les suggestions de musique s'envoient automatiquement dans votre Google Sheets, suivez ces étapes simples :

## Étape 1 : Créer le Google Sheets
1. Allez sur [Google Sheets](https://sheets.new) et créez un nouveau document.
2. Nommez le document comme vous le souhaitez (ex: "Suggestions Musique").
3. Dans la première ligne, ajoutez les en-têtes suivants :
   - Cellule A1 : `Date`
   - Cellule B1 : `Titre`
   - Cellule C1 : `Artiste`
   - Cellule D1 : `Album`

## Étape 2 : Créer le script de liaison (Google Apps Script)
1. Dans votre Google Sheets, cliquez sur le menu **Extensions** > **Apps Script**.
2. Un nouvel onglet va s'ouvrir. Effacez tout le code existant.
3. Copiez et collez le code suivant :

```javascript
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Récupération des paramètres envoyés par le site web
  var trackName = e.parameter.trackName || "Inconnu";
  var artistName = e.parameter.artistName || "Inconnu";
  var albumName = e.parameter.albumName || "Inconnu";
  
  // Date de la suggestion
  var timestamp = new Date();
  
  // Ajout de la ligne dans le Google Sheet
  sheet.appendRow([timestamp, trackName, artistName, albumName]);
  
  // Réponse renvoyée au site web
  return ContentService.createTextOutput(JSON.stringify({"result": "success"}))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Étape 3 : Déployer le script
1. En haut à droite de l'éditeur de script, cliquez sur le bouton bleu **Déployer** > **Nouvelle implémentation**.
2. Cliquez sur l'icône d'engrenage ⚙️ à côté de "Sélectionner le type" et choisissez **Application Web**.
3. Remplissez les paramètres ainsi :
   - **Description** : `Webhook Musique` (ou ce que vous voulez)
   - **Exécuter en tant que** : `Moi (votre_email@gmail.com)`
   - **Qui a accès** : `Tout le monde` (Très important !)
4. Cliquez sur **Déployer**.
5. *Note : Lors du premier déploiement, Google vous demandera d'autoriser les accès. Cliquez sur "Autoriser l'accès", choisissez votre compte, puis cliquez sur "Paramètres avancés" et "Aller à Projet sans titre (non sécurisé)".*
6. Une fois déployé, copiez l'**URL de l'application Web** qui s'affiche (elle ressemble à `https://script.google.com/macros/s/AKfycb.../exec`).

## Étape 4 : Connecter le site web
1. Ouvrez le fichier `app.js` de ce projet.
2. À la ligne 6, repérez la variable `GOOGLE_SCRIPT_URL`.
3. Remplacez le texte `'VOTRE_URL_GOOGLE_APPS_SCRIPT_ICI'` par l'URL que vous venez de copier.
   
   *Exemple :*
   ```javascript
   const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```

🎉 **C'est terminé !** 
Vous pouvez maintenant ouvrir le fichier `index.html` dans votre navigateur, rechercher une musique, cliquer sur "Suggérer" et la voir apparaître instantanément dans votre Google Sheets.
