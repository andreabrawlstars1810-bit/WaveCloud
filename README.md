# WaveCloud

Une bibliothèque musicale personnelle, moderne et gratuite à héberger.

## Ce que le projet fait

- Import de MP3 depuis l'ordinateur
- Stockage dans un dossier `WaveCloud` de Google Drive
- Lecture depuis le navigateur
- Téléchargement possible via l'interface Drive (la version de base inclut surtout la lecture ; un bouton de téléchargement peut être ajouté)
- Favoris
- Playlists
- Recherche
- Égaliseur Web Audio : basses / médiums / aigus
- Interface responsive téléphone + ordinateur
- Hébergement statique possible gratuitement avec GitHub Pages

## 1. Configuration Google Drive

Le site utilise OAuth Google côté navigateur. Google recommande Google Identity Services pour les applications JavaScript et indique qu'un client web n'utilise pas de secret client. 

1. Crée un projet dans Google Cloud.
2. Active **Google Drive API**.
3. Configure l'écran de consentement / Google Auth Platform.
4. Crée un identifiant OAuth 2.0 de type **Application Web**.
5. Ajoute l'origine de ton site dans les **Authorized JavaScript origins**.
6. Copie le Client ID dans `config.js` :

```js
const GOOGLE_CLIENT_ID = "TON_CLIENT_ID.apps.googleusercontent.com";
```

Le projet demande le scope `drive.file`, volontairement limité : l'application peut gérer les fichiers créés ou ouverts par l'application, au lieu de demander un accès complet à tout le Drive.

Documentation officielle :
- https://developers.google.com/workspace/drive/api/quickstart/js
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth

## 2. Tester

Comme OAuth et certaines APIs du navigateur ont besoin d'un contexte web, utilise un petit serveur local.

Avec Python :

```bash
python -m http.server 8080
```

Puis ouvre :

```text
http://localhost:8080
```

Ajoute `http://localhost:8080` aux origines JavaScript autorisées de ton client OAuth.

## 3. Mettre le site en ligne gratuitement

GitHub Pages peut héberger ce site statique depuis un dépôt GitHub. Avec GitHub Free, les dépôts utilisés pour Pages doivent être publics.

Après publication, ajoute ton URL GitHub Pages dans les **Authorized JavaScript origins** de Google Cloud, par exemple :

```text
https://TON-PSEUDO.github.io
```

Documentation :
- https://docs.github.com/fr/pages/quickstart

## Important

Google Drive sert ici de stockage de tes fichiers musicaux. Le quota disponible dépend de ton compte Google Drive.

La version fournie est volontairement sans serveur : le navigateur parle directement à Google Drive après ton autorisation. Cela permet d'éviter de payer un hébergement backend.

## Structure

- `index.html` — interface
- `style.css` — design
- `app.js` — lecteur, playlists, favoris, égaliseur et Drive
- `config.js` — Client ID Google à renseigner


## Comptes utilisateurs

La version actuelle inclut maintenant une page de connexion **avec Google**.

Le principe est :
1. L'utilisateur se connecte avec son compte Google.
2. WaveCloud récupère son identité Google.
3. L'utilisateur autorise WaveCloud à utiliser son espace Drive avec le scope `drive.file`.
4. WaveCloud crée/utilise son dossier `WaveCloud` dans son Drive.
5. Les morceaux, favoris et playlists sont ainsi retrouvables depuis ses autres appareils lorsqu'il se reconnecte avec le même compte.

Pour un vrai service public avec plusieurs milliers d'utilisateurs, il serait préférable d'ajouter un backend d'authentification/base de données. Pour une application personnelle ou un petit nombre d'utilisateurs, cette architecture sans serveur est beaucoup plus simple et peut rester gratuite.
