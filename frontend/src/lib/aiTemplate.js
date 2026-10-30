/**
 * Gabarit IA : JSON que l'enseignant donne à son IA (avec ses critères de performance et son examen)
 * pour obtenir une grille importable dans EvaluPro.
 *
 * Modèle de la grille :
 *   Critère de performance (fourni par l'enseignant)
 *     ├── Tâches (champ `subCriteria`) : questions / consignes précises, avec points, rétroaction
 *     │     └── Niveaux propres à la tâche (insuffisant … excellent), rédigés pour cette question
 *     └── Niveaux de performance du critère : résumé d'ensemble
 */

export const LEVEL_SCALES = {
  3: [
    { label: "Insuffisant", minPct: 0, maxPct: 0.3 },
    { label: "Satisfaisant", minPct: 0.6, maxPct: 0.75 },
    { label: "Excellent", minPct: 0.85, maxPct: 1 },
  ],
  4: [
    { label: "Insuffisant", minPct: 0, maxPct: 0.3 },
    { label: "Partiel", minPct: 0.6, maxPct: 0.68 },
    { label: "Satisfaisant", minPct: 0.75, maxPct: 0.82 },
    { label: "Excellent", minPct: 0.9, maxPct: 1 },
  ],
  5: [
    { label: "Insuffisant", minPct: 0, maxPct: 0.3 },
    { label: "Partiel", minPct: 0.6, maxPct: 0.65 },
    { label: "Satisfaisant", minPct: 0.7, maxPct: 0.75 },
    { label: "Très satisfaisant", minPct: 0.8, maxPct: 0.85 },
    { label: "Excellent", minPct: 0.9, maxPct: 1 },
  ],
};

export const DEFAULT_AI_CONFIG = {
  courseId: "",
  langue: "fr",
  niveaux: "4",
  pointsPartiels: true,
  inclureFeedbackGlobal: true,
  instructionsIa: "",
};

const FEEDBACK_BANDS = [[0, 60], [60, 75], [75, 85], [85, 95], [95, 100]];
const COLORS = ["border-blue-500", "border-green-500", "border-purple-500", "border-orange-500", "border-red-500", "border-indigo-500"];

const TEXT = {
  fr: {
    role: "Expert en technopédagogie collégiale, spécialisé dans la construction de grilles d'évaluation critériées à échelle descriptive.",
    format:
      "Remplis l'objet 'template_a_remplir'. Ta réponse finale doit être UNIQUEMENT le JSON rempli, qui commence par { \"title\": ... }. N'inclus PAS l'objet '_prompt_configuration' dans ta réponse.",
    provided:
      "L'enseignant te fournit, en plus de ce gabarit : (1) les éléments de compétence ou critères de performance de son cours (OBLIGATOIRE), (2) son examen ou l'énoncé du travail avec les points de chaque question (OBLIGATOIRE), (3) optionnellement un corrigé, un barème ou des consignes. Si (1) ou (2) est absent, ne génère pas de grille : demande-le.",
    logic: [
      "1. Les critères de performance appartiennent à l'enseignant. Utilise EXACTEMENT ceux qu'il fournit : même titre, même nombre, aucun ajout, aucune fusion. Ils sont larges (ex. « Installer et administrer les services d'infrastructure réseau »). Mets l'élément de compétence correspondant dans `competencyElement` si l'enseignant l'indique.",
      "2. Les tâches (`subCriteria`) sont la partie concrète et vérifiable : chaque question ou consigne de l'énoncé devient une tâche, rattachée au critère qu'elle permet de juger (ex. « Déploiement d'OPNsense et configuration adéquate des interfaces »). Une tâche appartient à UN SEUL critère. Si une question couvre deux critères, scinde-la en deux tâches (ex. « Q12a … », « Q12b … ») avec leurs propres points. Quand l'énoncé est une suite d'ÉTAPES ou de consignes (laboratoire, travail pratique) plutôt que des questions numérotées, ne fais PAS une seule tâche par étape : décortique chaque étape en éléments distincts, observables et notables un à un (ex. une carte réseau configurée, un service installé, une règle appliquée, une capture exigée), chacun étant une tâche. Mets le nom de l'étape dans `group` de chacune de ses tâches pour les regrouper à la correction. N'invente aucune exigence absente de l'énoncé, mais ne laisse de côté AUCUNE exigence qu'il contient. Si l'énoncé ne donne que le total de l'étape, répartis ses points entre les éléments de façon raisonnable (somme exacte) et signale cette répartition dans `aValider`.",
      "3. Les points vivent dans les tâches : `pts` est le maximum de points de la tâche. La somme des `pts` des tâches d'un critère = `weight` du critère. La somme des `weight` = total de l'examen (pas forcément 100).",
      "4. CHAQUE tâche a ses propres niveaux de performance (`levels` dans la tâche) : chaque `desc` décrit ce que l'élève a réussi ou raté À CETTE QUESTION précise (résultat attendu, erreur typique), jamais en général. Les descripteurs d'une même tâche doivent être clairement différents d'un niveau à l'autre. Rédige d'abord Excellent, Satisfaisant et Insuffisant, puis les niveaux intermédiaires. ATTENTION : pour un niveau intermédiaire (Partiel, Satisfaisant) tu ne peux PAS savoir quelle erreur précise l'élève a commise (un élève peut avoir bien renommé la carte et s'être trompé d'adresse). Ne désigne donc jamais un élément particulier comme raté (« la carte n'est pas renommée »). Décris plutôt le DEGRÉ d'atteinte de l'ensemble des éléments attendus de la tâche (ex. « La plupart des éléments demandés sont conformes; un ou deux détails sont imprécis ou manquants », « Une partie seulement des éléments demandés est conforme »), au besoin en rappelant entre parenthèses la liste de ce qui est évalué sans dire lequel manque. Seuls Excellent (tout est conforme : énumère ce qui est attendu) et Insuffisant (rien ou presque rien de fonctionnel : tu peux donner plusieurs exemples d'échecs possibles) peuvent être concrets. Les `levels` du critère, eux, résument la maîtrise d'ensemble (sans recompter les tâches ni écrire « 7 tâches sur 10 »).",
      "5. La rétroaction d'une tâche (`feedback`) est affichée à l'élève quand la tâche n'a pas obtenu tous ses points. Rédige-la comme un CONSTAT de correction, en une phrase nominale ou au passé, sur l'erreur ou l'oubli probable (ex. « Redirecteur DNS mal configuré ou option manquante », « Pool d'adresses hors de la plage demandée ou adaptateur incorrect »). Comme plusieurs erreurs sont possibles, énumère les causes probables avec « ou » au lieu d'en affirmer une seule. Jamais d'ordre ni de conseil au présent ou à l'impératif (pas de « Assure-toi… », « Vérifie… », « Révise… »).",
      "6. Un critère = une seule qualité jugée. Une même erreur ne doit pas être pénalisée dans deux critères.",
      "7. En cas de doute (rattachement ambigu, points absents ou incohérents, question qui ne correspond à aucun critère), NE DEVINE PAS : fais ton meilleur choix et ajoute une ligne explicative dans `aValider`.",
    ],
    math: "Somme des `pts` des tâches = `weight` du critère. Somme des `weight` = total de l'examen. Les valeurs de `weight` et `pts` dans le gabarit (0) sont des substituts à remplacer.",
    levels: (n) =>
      `Garde exactement ces ${n} niveaux (mêmes \`label\`, \`minPct\` et \`maxPct\`) pour chaque critère. \`minPct\` est le pourcentage à partir duquel le niveau s'applique ; \`maxPct\` est la note proposée quand le correcteur clique sur le niveau. Seuls les \`desc\` sont à rédiger (niveaux du critère ET niveaux de chaque tâche).`,
    partial: "Les points partiels sont permis : le correcteur peut donner à une tâche n'importe quelle note entre 0 et `pts`. Décris donc dans `feedback` ce qui est attendu pour obtenir tous les points.",
    noPartial: "Les tâches sont notées tout ou rien (réussie = `pts`, sinon 0).",
    feedback:
      "Rédige 5 messages de rétroaction globale (`feedbackMessages`), un par tranche de note. Ton encourageant, motivant, professionnel et respectueux. Tutoie l'élève. Ne copie jamais le texte d'instruction.",
    checks: [
      "Chaque critère de l'enseignant est présent, avec son titre exact.",
      "Chaque question et chaque exigence de l'énoncé apparaît dans exactement une tâche (aucune oubliée, aucune en double), et les étapes sont décortiquées en éléments notables.",
      "Chaque `feedback` est un constat (erreur ou oubli), sans impératif ni conseil au présent.",
      "Les descripteurs Partiel et Satisfaisant d'une tâche ne désignent aucun élément précis comme raté : ils décrivent un degré d'atteinte.",
      "Aucun critère sans tâche n'est resté dans la réponse.",
      "Les sommes de points concordent (tâches → critère → total de l'examen).",
      "Chaque tâche a ses propres niveaux, spécifiques à sa question, et deux niveaux d'une même tâche n'ont pas la même description.",
      "Tout ce qui est incertain est listé dans `aValider`.",
    ],
    exampleNote: "EXEMPLE DE LOGIQUE UNIQUEMENT : ne reprends ni son contenu ni ses points.",
    example: {
      criterion: "Installer et administrer les services d'infrastructure réseau",
      weight: 20,
      tasks: [
        ["Déploiement d'OPNsense et configuration adéquate des interfaces", 6, "Interfaces WAN/LAN inversées ou adresses incorrectes."],
        ["Règles de filtrage conformes à la politique demandée", 8, "Règle manquante, trop permissive ou placée dans le mauvais ordre."],
        ["Tests de connectivité documentés", 6, "Capture ou sortie de commande absente pour au moins un test."],
      ],
      levelDesc: "Excellent : le pare-feu est fonctionnel et respecte entièrement la politique ; Insuffisant : le pare-feu n'est pas fonctionnel ou ne reflète pas la politique.",
    },
    title: "Nom du cours ou du sujet principal",
    taskTitle: "Titre de l'évaluation (examen, laboratoire, travail pratique)",
    criterionTitle: "Titre exact du critère de performance fourni par l'enseignant",
    competency: "Élément de compétence visé (si fourni)",
    taskLabel: "Tâche précise et vérifiable tirée de l'énoncé",
    taskFeedback: "Constat d'erreur ou d'oubli si cette tâche n'obtient pas tous ses points (nominal ou au passé, jamais à l'impératif).",
    taskGroup: "Nom de l'étape ou du bloc de l'énoncé auquel appartient cette tâche (facultatif)",
    levelDesc: (label) => `Décris la qualité de la performance au niveau « ${label} » pour ce critère.`,
    taskLevelDesc: (label) => `Décris ce que l'élève a réussi ou raté à CETTE question au niveau « ${label} ».`,
    feedbackMsg: "Message de rétroaction pour cette tranche de note (à rédiger).",
    toValidate: "Liste ici chaque point incertain à faire valider par l'enseignant.",
    repeatCriteria: "Ce gabarit montre UN critère en exemple : répète la même structure pour CHAQUE critère de l'enseignant.",
    providedWithCourse: (n, title) =>
      `Les ${n} compétences / critères de performance du cours « ${title} » sont déjà inclus dans ce gabarit (voir 'criteres_de_performance_du_cours' et 'template_a_remplir.criteria'). L'enseignant te fournit en plus son examen ou l'énoncé du travail avec les points de chaque question (OBLIGATOIRE), et éventuellement un corrigé, un barème ou des consignes. Si l'examen est absent, ne génère pas de grille : demande-le.`,
    courseStructure: (n) =>
      `Le gabarit contient déjà ${n} critères, un par compétence du cours, dans cet ordre. Garde leur titre, leur \`competencyElement\` et leur \`competencyId\` (s'il est présent) tels quels et ne les supprime pas. Remplis pour chacun : \`weight\`, les tâches (\`subCriteria\`, à répéter autant que nécessaire, chacune avec ses \`levels\`) et les \`desc\` des niveaux. Si l'examen ne contient AUCUNE question ni exigence rattachée à une compétence, SUPPRIME ce critère de la réponse (pas de critère à 0 point, pas de niveaux « non évalué ») et signale-le dans \`aValider\`.`,
    courseCriterionNote: "Titre du critère fourni par l'enseignant : à conserver tel quel.",
  },
  en: {
    role: "Expert in college-level educational technology, specialised in building criterion-referenced rubrics with descriptive scales.",
    format:
      "Fill the 'template_a_remplir' object. Your final answer must be ONLY the completed JSON, starting with { \"title\": ... }. Do NOT include '_prompt_configuration' in your answer.",
    provided:
      "In addition to this template, the teacher provides: (1) the competency elements or performance criteria of the course (REQUIRED), (2) the exam or assignment text with the points of each question (REQUIRED), (3) optionally an answer key, a marking scheme or instructions. If (1) or (2) is missing, do not generate a rubric: ask for it.",
    logic: [
      "1. Performance criteria belong to the teacher. Use EXACTLY the ones provided: same title, same count, no additions, no merging. They are broad (e.g. \"Install and administer network infrastructure services\"). Put the matching competency element in `competencyElement` when given.",
      "2. Tasks (`subCriteria`) are the concrete, verifiable part: each question or instruction in the exam becomes a task attached to the criterion it helps judge (e.g. \"Deploy OPNsense and configure the interfaces correctly\"). A task belongs to ONE criterion only. If a question covers two criteria, split it into two tasks (e.g. \"Q12a …\", \"Q12b …\") with their own points. When the exam is a sequence of STEPS or instructions (lab, practical work) rather than numbered questions, do NOT make one task per step: break each step down into distinct, observable, individually gradable elements (e.g. one network card configured, one service installed, one rule applied, one required screenshot), each being a task. Put the step name in each task's `group` so they are grouped when grading. Invent no requirement absent from the exam, but leave NO requirement it contains out. If the exam only gives the step total, split its points between the elements reasonably (exact sum) and mention the split in `aValider`.",
      "3. Points live in tasks: `pts` is the task's maximum. The sum of task `pts` in a criterion = the criterion's `weight`. The sum of all `weight` = the exam total (not necessarily 100).",
      "4. EACH task has its own performance levels (`levels` inside the task): each `desc` describes what the student achieved or missed ON THAT SPECIFIC QUESTION (expected result, typical mistake), never in general terms. Descriptors of one task must clearly differ from level to level. Write Excellent, Satisfactory and Insufficient first, then the intermediate levels. WARNING: for an intermediate level (Partial, Satisfactory) you CANNOT know which precise mistake the student made (a student may have renamed the card correctly and mistyped the address). Never name one particular element as failed (\"the card is not renamed\"). Describe instead the DEGREE to which the task's expected elements as a whole are met (e.g. \"Most requested elements are correct; one or two details are imprecise or missing\", \"Only some of the requested elements are correct\"), optionally recalling in brackets what is assessed without saying which part is missing. Only Excellent (everything is correct: list what is expected) and Insufficient (nothing or almost nothing works: you may give several examples of possible failures) may be concrete. The criterion's own `levels` summarise overall mastery (without recounting tasks or writing \"7 tasks out of 10\").",
      "5. A task's `feedback` is shown to the student when the task did not get full points. Write it as a grading OBSERVATION, a noun phrase or past tense, about the likely mistake or omission (e.g. \"DNS forwarder misconfigured or option missing\", \"Address pool outside the requested range or wrong adapter\"). Since several mistakes are possible, list the likely causes with \"or\" instead of asserting a single one. Never an instruction or advice in the present or imperative (no \"Make sure…\", \"Check…\", \"Review…\").",
      "6. One criterion = one quality judged. The same mistake must not be penalised in two criteria.",
      "7. When in doubt (ambiguous mapping, missing or inconsistent points, a question matching no criterion), DO NOT GUESS: make your best choice and add an explanatory line in `aValider`.",
    ],
    math: "Sum of task `pts` = criterion `weight`. Sum of `weight` = exam total. The `weight` and `pts` values in the template (0) are placeholders to replace.",
    levels: (n) =>
      `Keep exactly these ${n} levels (same \`label\`, \`minPct\`, \`maxPct\`) for every criterion. \`minPct\` is the percentage from which the level applies; \`maxPct\` is the suggested score when the grader clicks the level. Only the \`desc\` fields are yours to write (criterion levels AND task levels).`,
    partial: "Partial points are allowed: the grader can give a task any score between 0 and `pts`. Describe in `feedback` what is expected to earn full points.",
    noPartial: "Tasks are all-or-nothing (done = `pts`, otherwise 0).",
    feedback:
      "Write 5 global feedback messages (`feedbackMessages`), one per score band. Encouraging, motivating, professional and respectful tone. Never copy instruction text.",
    checks: [
      "Every teacher criterion is present with its exact title.",
      "Every exam question and requirement appears in exactly one task (none missing, none duplicated), and steps are broken down into gradable elements.",
      "Every `feedback` is an observation (mistake or omission), with no imperative or present-tense advice.",
      "Partial and Satisfactory descriptors of a task name no specific element as failed: they describe a degree of achievement.",
      "No criterion without tasks is left in the answer.",
      "Point sums match (tasks → criterion → exam total).",
      "Every task has its own question-specific levels, and no two levels of a task share the same description.",
      "Anything uncertain is listed in `aValider`.",
    ],
    exampleNote: "LOGIC EXAMPLE ONLY: do not reuse its content or points.",
    example: {
      criterion: "Install and administer network infrastructure services",
      weight: 20,
      tasks: [
        ["Deploy OPNsense and configure the interfaces correctly", 6, "WAN/LAN interfaces swapped or incorrect addresses."],
        ["Filtering rules matching the requested policy", 8, "Rule missing, too permissive or in the wrong order."],
        ["Documented connectivity tests", 6, "Screenshot or command output missing for at least one test."],
      ],
      levelDesc: "Excellent: the firewall works and fully follows the policy; Insufficient: the firewall does not work or does not reflect the policy.",
    },
    title: "Course or main topic",
    taskTitle: "Assessment title (exam, lab, practical work)",
    criterionTitle: "Exact title of the performance criterion provided by the teacher",
    competency: "Targeted competency element (if provided)",
    taskLabel: "Precise, verifiable task taken from the exam",
    taskFeedback: "Observation of the mistake or omission if this task does not get full points (noun phrase or past tense, never imperative).",
    taskGroup: "Name of the step or block of the exam this task belongs to (optional)",
    levelDesc: (label) => `Describe the quality of performance at the "${label}" level for this criterion.`,
    taskLevelDesc: (label) => `Describe what the student achieved or missed on THIS question at the "${label}" level.`,
    feedbackMsg: "Feedback message for this score band (to write).",
    toValidate: "List here each uncertain point for the teacher to validate.",
    repeatCriteria: "This template shows ONE example criterion: repeat the same structure for EACH teacher criterion.",
    providedWithCourse: (n, title) =>
      `The ${n} competencies / performance criteria of the course "${title}" are already included in this template (see 'criteres_de_performance_du_cours' and 'template_a_remplir.criteria'). The teacher additionally provides the exam or assignment text with the points of each question (REQUIRED), and optionally an answer key, a marking scheme or instructions. If the exam is missing, do not generate a rubric: ask for it.`,
    courseStructure: (n) =>
      `The template already contains ${n} criteria, one per course competency, in this order. Keep their title, \`competencyElement\` and \`competencyId\` (when present) unchanged and do not remove them. For each one fill in: \`weight\`, the tasks (\`subCriteria\`, repeated as needed, each with its own \`levels\`) and the level \`desc\` fields. If the exam contains NO question or requirement tied to a competency, REMOVE that criterion from your answer (no 0-point criterion, no "not assessed" levels) and mention it in \`aValider\`.`,
    courseCriterionNote: "Criterion title provided by the teacher: keep it unchanged.",
  },
};

export function buildAITemplate(config = {}) {
  const cfg = { ...DEFAULT_AI_CONFIG, ...config };
  const T = TEXT[cfg.langue] || TEXT.fr;
  const scale = LEVEL_SCALES[cfg.niveaux] || LEVEL_SCALES[4];
  const teacherNotes = String(cfg.instructionsIa || "").trim();

  const levels = scale.map((lvl) => ({
    label: lvl.label,
    minPct: lvl.minPct,
    maxPct: lvl.maxPct,
    desc: T.levelDesc(lvl.label),
  }));

  const makeCriterion = (index, title, competencyElement, competencyId = "") => ({
    id: `c${index + 1}`,
    title,
    competencyElement,
    ...(competencyId ? { competencyId } : {}),
    weight: 0,
    color: COLORS[index % COLORS.length],
    levels: levels.map((lvl) => ({ ...lvl })),
    subCriteria: [1, 2].map((n) => ({
      id: `c${index + 1}-sc${n}`,
      label: `${T.taskLabel} ${n}`,
      pts: 0,
      feedback: T.taskFeedback,
      group: T.taskGroup,
      levels: levels.map((lvl) => ({ ...lvl, desc: T.taskLevelDesc(lvl.label) })),
    })),
  });

  const courseTitle = String(cfg.course?.title || "").trim();
  const competencies = (cfg.course?.competencies || [])
    .map((c) => ({ id: String(c?.id || "").trim(), title: String(c?.title || "").trim(), description: String(c?.description || "").trim() }))
    .filter((c) => c.title);
  const hasCourse = Boolean(courseTitle) && competencies.length > 0;

  const criteria = hasCourse
    ? competencies.map((c, i) => makeCriterion(i, c.title, c.title, c.id))
    : [makeCriterion(0, T.criterionTitle, T.competency)];

  const template_a_remplir = {
    title: hasCourse ? courseTitle : T.title,
    taskTitle: T.taskTitle,
    linkCompetencies: true,
    criteria,
    ...(cfg.inclureFeedbackGlobal
      ? { feedbackMessages: FEEDBACK_BANDS.map(([minPct, maxPct]) => ({ minPct, maxPct, message: T.feedbackMsg })) }
      : {}),
    aValider: [T.toValidate],
  };

  const ex = T.example;
  return {
    _prompt_configuration: {
      role: T.role,
      reponse_attendue: T.format,
      ce_que_l_enseignant_te_fournit: hasCourse ? T.providedWithCourse(competencies.length, courseTitle) : T.provided,
      ...(hasCourse
        ? {
            criteres_de_performance_du_cours: competencies.map((c, i) => ({
              numero: i + 1,
              titre: c.title,
              ...(c.description ? { precisions: c.description } : {}),
            })),
          }
        : {}),
      logique_de_la_grille: T.logic,
      structure: hasCourse ? T.courseStructure(competencies.length) : T.repeatCriteria,
      regles_mathematiques: T.math,
      niveaux_de_performance: T.levels(scale.length),
      points: cfg.pointsPartiels ? T.partial : T.noPartial,
      ...(cfg.inclureFeedbackGlobal ? { retroaction_globale: T.feedback } : {}),
      auto_verification_avant_de_repondre: T.checks,
      exemple_de_logique: {
        note: T.exampleNote,
        critere: ex.criterion,
        weight: ex.weight,
        taches: ex.tasks.map(([label, pts, feedback]) => ({ label, pts, feedback })),
        niveaux: ex.levelDesc,
      },
      instructions_specifiques_utilisateur: teacherNotes || null,
    },
    template_a_remplir,
  };
}

/**
 * Vrai si le texte est encore une consigne du gabarit que l'IA devait remplacer (titre, tâche, rétroaction,
 * descripteur de niveau, message global ou « à valider »). Sert à avertir avant d'enregistrer.
 */
export function isTemplatePlaceholder(text) {
  const t = String(text ?? "").trim().toLowerCase();
  if (!t) return false;
  return Object.values(TEXT).some((T) => {
    const exact = [T.title, T.taskTitle, T.criterionTitle, T.competency, T.taskFeedback, T.taskGroup, T.feedbackMsg, T.toValidate];
    if (exact.some((x) => t === String(x).trim().toLowerCase())) return true;
    if (t.startsWith(String(T.taskLabel).trim().toLowerCase())) return true; // « Tâche précise… 1 »
    return Object.values(LEVEL_SCALES)
      .flat()
      .some((lvl) => [T.levelDesc(lvl.label), T.taskLevelDesc(lvl.label)].some((x) => t === x.trim().toLowerCase()));
  });
}
