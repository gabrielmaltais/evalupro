# Migration vers app moderne + MongoDB

Ce projet contient maintenant:
- `eval.html`: version legacy statique (reference)
- `backend/`: API Express + MongoDB + JWT + RBAC
- `frontend/`: SPA React (Vite) connectee a l'API

## Prerequis
- Node.js 20+
- MongoDB local ou Atlas

## Configuration
1. Copier `backend/.env.example` vers `backend/.env` et remplir les valeurs.
2. Copier `frontend/.env.example` vers `frontend/.env`.

## Lancer en local
- Backend: `npm run dev:backend`
- Frontend: `npm run dev:frontend`

## Tests et build
- Tous les tests: `npm test`
- Build frontend: `npm run build`

## API principale
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Rubrics: `GET/POST/PUT/DELETE /api/rubrics`
- Evaluations: `GET/POST/GET:id/PUT:id/DELETE:id /api/evaluations`

## Import legacy
Script: `backend/scripts/import-legacy.js`

Format attendu:
```json
{
  "config": { "courseTitle": "...", "taskTitle": "...", "criteria": [] },
  "state": { "studentName": "...", "date": "YYYY-MM-DD", "scores": {}, "comments": {}, "generalComment": "..." }
}
```

Commande:
`node backend/scripts/import-legacy.js ./legacy.json`

## Mapping eval.html -> MongoDB
- `App.config.courseTitle` -> `Rubric.title`
- `App.config.taskTitle` -> `Rubric.taskTitle`
- `App.config.criteria[]` -> `Rubric.criteria[]`
- `App.state.studentName` -> `Evaluation.studentName`
- `App.state.date` -> `Evaluation.date`
- `App.state.scores` -> `Evaluation.scores`
- `App.state.comments` -> `Evaluation.comments`
- `App.state.generalComment` -> `Evaluation.generalComment`
