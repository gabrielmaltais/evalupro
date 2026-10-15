# Plan : remettre de l'ordre dans « Session en cours »

Analyse du 2026-10-15. Plan appliqué le même jour (backend, page « Ma session », filtres de Corriger, Suivi et Envois).

## Ce qui ne va pas aujourd'hui

**1. La même information est enregistrée à trois endroits.**
« Ce qu'on peut corriger » est rangé :
- dans la session (`Session.courses[].rubrics`, page Cours et évaluations) ;
- dans chaque groupe (`Group.courses`, modifié depuis 3 pages : Groupes, Cours et évaluations, et l'éditeur de grille) ;
- encore dans chaque groupe (`Group.rubrics`, une copie recalculée par `syncGroups`). Cette copie peut aussi être modifiée
  directement par 4 autres chemins : `importRubrics`, `PUT /groups` avec `rubrics`, `setGroupsByName` (page Grilles)
  et `DELETE /groups/:id/rubrics`.

Avec autant de chemins, la copie finit par ne plus correspondre à la session. Corriger lit pourtant cette copie
(`rubric.groups`, calculé à partir de `Group.rubrics`).

**2. Les deux pages font la même chose, de façon différente.**
- Groupes propose **tous** les cours de la bibliothèque, alors que Cours et évaluations ne propose que ceux de la session.
- Sur la page Groupes, cocher un cours qui n'est pas encore dans la session l'y ajoute en silence, avec toutes ses
  évaluations actives (`ensureCoursesInSession`). L'enseignant ne le voit pas.

**3. Corriger, Suivi et Envois ne lisent pas la même source.**
- Corriger : grilles **actives** (option de la bibliothèque) **et** présentes dans `Group.rubrics`, filtrées par **nom** de groupe.
  Une évaluation cochée dans la session mais marquée inactive dans la bibliothèque n'apparaît donc pas.
- Suivi et Envois : les évaluations qui ont au moins une copie dans la session active **ou sans session**.
  Des copies anciennes, d'avant les sessions, s'y mêlent, et ce qui est coché dans la session n'est pas pris en compte.
- Deux sélections de groupe distinctes (`studentPickerGroup` et `hubSelectedGroup`), resynchronisées après coup
  et enregistrées sous 3 clés `localStorage`. Une valeur mémorisée peut désigner un groupe ou une évaluation retirés.

**4. Rien ne protège les corrections.** On peut décocher une évaluation corrigée sans aucun avertissement.

## Ce que je propose

**Une seule source de vérité :**
- la session dit **quels cours** et **quelles évaluations** (`Session.courses[].rubrics`) ;
- le groupe dit seulement **quels cours il suit** (`Group.courses`, limité aux cours de la session) ;
- les évaluations corrigeables pour un groupe se **calculent** : évaluations cochées des cours que suit le groupe.
  `Group.rubrics` n'est plus écrit. On le garde en base pour les archives, sans s'en servir.

**Une seule page « Ma session »** (je la recommande à deux pages séparées, car les cours dépendent des groupes) :
1. en haut, les **groupes** de la session (pastilles ajouter / retirer, comme aujourd'hui) ;
2. dessous, une carte par **cours** : ses évaluations à cocher, avec la mention
   **« (12 copies corrigées) »**, puis les pastilles des groupes qui suivent ce cours.
   Décocher une évaluation corrigée demande une confirmation qui indique le nombre de copies.
   Les copies restent en base et la réactiver les retrouve.
L'ancienne adresse `/session/groupes` redirige vers cette page.

**Les mêmes filtres partout** (Corriger, Suivi, Envois) :
- Groupe : groupes de la session. Cours : cours que suit ce groupe. Évaluation : évaluations cochées de ce cours.
- Suivi et Envois montrent en plus une évaluation **décochée qui a des copies**, avec la mention « (retirée) »,
  pour pouvoir encore envoyer ces copies.
- Une seule sélection Groupe › Cours › Évaluation, partagée par les trois onglets et mémorisée sous une seule clé.
  Si la valeur mémorisée n'existe plus, on revient au premier choix valide.

## Étapes

| # | Étape | Fichiers principaux |
|---|---|---|
| 1 | Backend : calculer les évaluations d'un groupe depuis la session (`availableRubrics`, `groupsOfRubric`, `rubric.groups`), retirer les écritures dans `Group.rubrics` (`syncGroups`, `importRubrics`, `addRubrics`, `setGroupsByName`, routes `/groups/:id/rubrics`). `PUT /groups` refuse un cours absent de la session. `describe()` ajoute `correctedCount` à chaque évaluation. La copie de session reprend `courses[].rubrics`. Tests. | `services/groupService.js`, `services/sessionCourseService.js`, `routes/groups.js`, `routes/rubrics.js`, `routes/sessions.js` |
| 2 | Page « Ma session » fusionnée, avec le nombre de copies corrigées et la confirmation. Suppression de `SessionGroups.jsx` et redirection. | `pages/SessionCourses.jsx`, `App.jsx`, `SessionLayout.jsx` |
| 3 | Éditeur de grille : garder seulement « utiliser dans la session en cours » (même API). Les liens groupe-cours se gèrent uniquement dans Ma session. | `pages/AdminRubric.jsx` |
| 4 | Corriger, Suivi, Envois : une source (`GET /sessions/:id/courses` + groupes), une sélection partagée, suppression du filtre « active » et des copies sans session. | `pages/Evaluations.jsx`, `routes/evaluations.js` (`email-targets`) |
| 5 | Nettoyage du code mort, build, tests, puis déploiement sur le CT 374. | |

Chaque étape est livrée et déployée séparément. Les étapes 1 et 2 vont ensemble, car la page a besoin de `correctedCount`.

## Ce qui ne change pas
Aucune copie d'évaluation n'est supprimée ni modifiée. Les sessions archivées gardent leur contenu.
Les groupes, élèves, cours et grilles de Ressources restent tels quels.
