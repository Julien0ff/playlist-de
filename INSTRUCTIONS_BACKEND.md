# 🚀 Guide de Configuration : Backend Spotify & Bot-Hosting.net

Le dossier `/backend` contient le serveur Node.js responsable de filtrer les suggestions (insultes) et de les ajouter automatiquement à votre playlist Spotify.

Pour que ce système fonctionne, vous devez relier le backend à votre compte Spotify via une API, puis l'héberger sur bot-hosting.net.

## Étape 1 : Créer une Application Spotify (Pour les clés API)

1. Allez sur le [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/) et connectez-vous avec votre compte Spotify.
2. Cliquez sur **"Create app"**.
3. Remplissez les informations :
   - **App name** : Suggestify Bot (ou ce que vous voulez)
   - **App description** : Bot pour ajouter des musiques
   - **Website** : Laissez vide
   - **Redirect URI** : Mettez `http://localhost:3000/callback` (Si Spotify affiche un message d'avertissement en orange "This URL is not secure", ignorez-le, c'est normal pour un localhost, vous pouvez quand même sauvegarder. Sinon mettez `https://localhost:3000/callback`).
4. Cochez les cases d'accord et faites **Save**.
5. Allez dans les paramètres de votre nouvelle App (Settings). Vous y trouverez votre **Client ID** et **Client Secret** (cliquez sur "View client secret"). Gardez-les de côté.

## Étape 2 : Obtenir le Refresh Token Spotify

Pour qu'un bot Node.js puisse modifier *votre* playlist sans que vous ayez à vous connecter manuellement chaque jour, il a besoin d'un "Refresh Token".

**Méthode la plus simple pour l'obtenir :**
1. Allez sur cet outil génial qui simplifie la vie des bots Spotify : [Spotify Refresh Token Generator](https://get-spotify-refresh-token.herokuapp.com/) (ou un outil similaire, ou faites-le via curl si vous êtes à l'aise).
2. Si vous préférez le faire vous même, vous pouvez utiliser l'URL suivante dans votre navigateur (remplacez `VOTRE_CLIENT_ID`) :
   `https://accounts.spotify.com/authorize?client_id=VOTRE_CLIENT_ID&response_type=code&redirect_uri=http://localhost:3000/callback&scope=playlist-modify-public%20playlist-modify-private`
3. Connectez-vous, acceptez les permissions.
4. Vous serez redirigé vers `localhost:3000/callback?code=UN_LONG_CODE`. Copiez ce code.
5. Utilisez ce code pour faire une requête POST vers `https://accounts.spotify.com/api/token` avec vos identifiants pour obtenir le fameux `refresh_token`.

*(Astuce : De nombreux tutoriels YouTube existent "How to get Spotify refresh token", cela prend 5 minutes !)*

## Étape 3 : Héberger sur Bot-Hosting.net

1. Connectez-vous sur votre panel [bot-hosting.net](https://bot-hosting.net).
2. Créez un nouveau serveur (Node.js).
3. Dans le gestionnaire de fichiers de votre serveur, **uploadez** tout le contenu du dossier `/backend` que je vous ai généré (`server.js`, `spotify.js`, `filter.js`, `package.json`).
4. Créez un nouveau fichier nommé `.env` directement sur votre panel bot-hosting, et collez ceci à l'intérieur en remplaçant par vos valeurs :

```env
PORT=3000
SPOTIFY_CLIENT_ID=votre_client_id_trouvé_a_l_etape_1
SPOTIFY_CLIENT_SECRET=votre_client_secret_trouvé_a_l_etape_1
SPOTIFY_REFRESH_TOKEN=votre_refresh_token_trouvé_a_l_etape_2
SPOTIFY_PLAYLIST_ID=l_id_de_votre_playlist_spotify
```
*(L'ID de votre playlist se trouve dans son URL : `https://open.spotify.com/playlist/ID_ICI?si=...`)*

5. Allez dans l'onglet **Console** ou **Startup** de votre panel et assurez-vous que la commande de démarrage est bien : `npm install && npm start`.
6. Démarrez votre serveur !

## Étape 4 : Lier le Site au Bot

Une fois votre serveur démarré sur bot-hosting.net, vous aurez une adresse/URL publique fournie par l'hébergeur pour votre serveur (ex: `https://node1.bot-hosting.net:12345` ou un nom de domaine gratuit).

1. Ouvrez le fichier `app.js` de votre site (le frontend).
2. Ligne 88 : Modifiez la variable `BACKEND_URL` pour mettre l'URL de votre serveur bot-hosting avec `/api/suggest` à la fin.
   Exemple : `const BACKEND_URL = 'https://adresse-de-mon-bot.bot-hosting.net/api/suggest';`

C'est fini ! Dès qu'un utilisateur cliquera sur "Suggérer", le site enverra la requête à votre bot Node.js. Ce dernier vérifiera le filtre anti-insultes et ajoutera instantanément le titre à la playlist Spotify.
