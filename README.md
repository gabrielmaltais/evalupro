# EvaluPro 🏫

Application web moderne de création de grilles d'évaluation, notation d'étudiants et génération de rapports PDF automatisés. Parfait pour les enseignants, chargé·es de laboratoire et professionnel·les de l'éducation.

## Fonctionnalités 🚀
- **Grilles dynamiques** : Éditeur de grilles d'évaluation 100% personnalisable.
- **Micro-cases (Sous-critères)** : Permet de cocher des éléments de validation spécifiques (parfait pour les examens techniques rigoureux).
- **Génération PDF** : Exportez des rapports PDF clairs, avec notes, rétroactions ciblées et calcul automatique des points.
- **Rétroaction verbale assistée** : Les points manqués s'affichent automatiquement sous forme d'explications dans le PDF final.
- **Prêt pour l'IA** : L'app peut exporter des modèles (gabari) JSON stricts pour permettre à une Intelligence Artificielle de faire avancer l'évaluation.
- **Conteneurisation complète** : Se déploie en 1 seule commande avec Docker (Monolithe : React + Express).

---

## Première connexion (compte administrateur)

Lors du **tout premier démarrage**, si la base MongoDB ne contient encore **aucun** utilisateur avec le rôle `admin`, l’application crée automatiquement un administrateur :

| Variable | Rôle | Valeur par défaut si non définie |
|----------|------|----------------------------------|
| `ADMIN_INITIAL_EMAIL` | Identifiant de connexion | `admin` |
| `ADMIN_INITIAL_PASSWORD` | Mot de passe initial | `AdminPro1` |
| `ADMIN_INITIAL_NAME` | Nom affiché | `Administrateur` |

**En production**, définissez impérativement `JWT_SECRET`, `ADMIN_INITIAL_EMAIL` et `ADMIN_INITIAL_PASSWORD` (long et aléatoire) dans votre `docker-compose` ou vos secrets d’orchestration, puis **changez le mot de passe** après la première connexion (Paramètres du compte). Les valeurs par défaut sont documentées dans le code à des fins de prise en main uniquement.

Référence des variables : [`backend/.env.example`](backend/.env.example).

---

## 🚀 Installation & Déploiement (Production)

L'application est conteneurisée et disponible publiquement sur Docker Hub (`gabrielmaltais/evalupro:latest`). Le backend (Node.js/Express) fournit l'API tout en servant statiquement l'interface React.

### Exigences
- Serveur avec **Docker** et **Docker Compose** d'installés.

### Étape 1 : Le fichier Docker Compose
Sur votre serveur de production, créez un dossier `evalupro` puis copiez le fichier [`docker-compose.yml`](docker-compose.yml) du dépôt (ou utilisez l’extrait ci‑dessous, équivalent) :

```yaml
services:
  evalupro-db:
    image: mongo:6-jammy
    container_name: evalupro_db
    restart: unless-stopped
    volumes:
      - evalupro_mongo_data:/data/db

  evalupro-app:
    image: gabrielmaltais/evalupro:latest
    container_name: evalupro_app
    restart: unless-stopped
    ports:
      - "80:4000"
    environment:
      - PORT=4000
      - MONGODB_URI=mongodb://evalupro-db:27017/evalupro
      - JWT_SECRET=votre_cle_longue_et_aleatoire
      - ADMIN_INITIAL_EMAIL=admin
      - ADMIN_INITIAL_PASSWORD=votre_mot_de_passe_initial_fort
    depends_on:
      - evalupro-db

volumes:
  evalupro_mongo_data:
```

🚨 **Important :** personnalisez `JWT_SECRET`, `ADMIN_INITIAL_PASSWORD` (et idéalement `ADMIN_INITIAL_EMAIL`) avant d’exposer l’app sur Internet.

### Étape 2 : Démarrage

Dans le même dossier que votre fichier docker-compose, exécutez la commande suivante pour télécharger les images et lancer l'application en arrière-plan :

```bash
docker-compose up -d
```

Voilà ! Votre application écoute désormais sur le **port 80** HTTP (vous devriez utiliser un Reverse Proxy comme Nginx Proxy Manager ou Traefik pour y associer un nom de domaine avec SSL/HTTPS).

---

## 🛠 Environnement de développement (Code Source)

Si vous souhaitez modifier l'application en local :

1. Assurez-vous d'avoir Node.js d'installé.
2. Démarrez un conteneur MongoDB local: `docker run -d -p 27017:27017 mongo`.

**Lancer le backend (API) :**
```bash
cd backend
npm install
npm run dev
# L'API s'ouvrira sur http://localhost:4000
```

**Lancer le frontend (Interface) :**
```bash
cd frontend
npm install
npm run dev
# L'interface s'ouvrira sur http://localhost:5173
```

---

## Carte technique rapide

Pour naviguer efficacement dans le projet (points d'entrée, flux auth/scoring/RBAC, zones à risque, routine de vérification), consulter [`docs/operational-map.md`](docs/operational-map.md).

## Dépôt public / sécurité

- Ne commitez pas de fichier `.env` réel : ils sont listés dans [`.gitignore`](.gitignore).
- Un workflow GitHub Actions construit l’image Docker et exécute un [smoke test](.github/workflows/docker-publish.yml) après le push sur `main`.
- Signalement de problèmes de sécurité : voir [`SECURITY.md`](SECURITY.md).

## Licence

MIT — voir [`LICENSE`](LICENSE).
