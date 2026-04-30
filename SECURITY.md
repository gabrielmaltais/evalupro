# Politique de sécurité

## Compte administrateur par défaut

Si aucun administrateur n’existe au premier démarrage, l’application crée un compte avec des identifiants **par défaut** (voir README et `backend/.env.example`). En production, définissez `ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_PASSWORD` et `JWT_SECRET` avant l’exposition réseau, puis changez le mot de passe après la première connexion.

## Signalement

Pour signaler une vulnérabilité, ouvrez une discussion privée avec le·a mainteneur·e du dépôt ou un issue **_Security_** selon les options activées sur GitHub. Ne publiez pas d’exploits exploitables en clair avant correction.

## Secrets

Ne commitez pas de clés API, mots de passe ou `SMTP_CONFIG_ENCRYPTION_KEY` réels. Utilisez des variables d’environnement et des secrets CI (Docker Hub, etc.).
