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

## 🚀 Installation & Déploiement (Production)

L'application est conteneurisée et disponible publiquement sur Docker Hub (`gabrielmaltais/evalupro:latest`). Le backend (Node.js/Express) fournit l'API tout en servant statiquement l'interface React.

### Exigences
- Serveur avec **Docker** et **Docker Compose** d'installés.

### Étape 1 : Le fichier Docker Compose
Sur votre serveur de production, créez un dossier `evalupro` puis ajoutez-y ce fichier `docker-compose.yml` :

```yaml
version: '3.8'

services:
  evalupro-app:
    image: gabrielmaltais/evalupro:latest
    container_name: evalupro_app
    restart: unless-stopped
    ports:
      - "80:4000"
    environment:
      - PORT=4000
      - MONGODB_URI=mongodb://evalupro-db:27017/evalupro
      - JWT_SECRET=votre_cle_de_securite_super_secrete
    depends_on:
      - evalupro-db

  evalupro-db:
    image: mongo:6-jammy
    container_name: evalupro_db
    restart: unless-stopped
    volumes:
      - evalupro_mongo_data:/data/db

volumes:
  evalupro_mongo_data:
```

🚨 **Important :** N'oubliez pas de modifier la variable `JWT_SECRET` pour une phrase ou structure très longue et aléatoire afin de sécuriser vos sessions.

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
