/**
 * Gabarit IA : JSON que l'enseignant donne à son IA (avec ses critères de performance et son examen)
 * pour obtenir une grille importable dans EvaluPro.
 *
 * Modèle de la grille :
 *   Critère de performance (fourni par l'enseignant)
 *     ├── Tâches (champ `subCriteria`) : questions / consignes précises, avec points, rétroaction
 *     └── Niveaux de performance : descripteurs rédigés à partir des tâches du critère
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
      "2. Les tâches (`subCriteria`) sont la partie concrète et vérifiable : chaque question ou consigne de l'énoncé devient une tâche, rattachée au critère qu'elle permet de juger (ex. « Déploiement d'OPNsense et configuration adéquate des interfaces »). Une tâche appartient à UN SEUL critère. Si une question couvre deux critères, scinde-la en deux tâches (ex. « Q12a … », « Q12b … ») avec leurs propres points.",
      "3. Les points vivent dans les tâches : `pts` est le maximum de points de la tâche. La somme des `pts` des tâches d'un critère = `weight` du critère. La somme des `weight` = total de l'examen (pas forcément 100).",
      "4. Les niveaux de performance résument la maîtrise du critère, ils ne recomptent pas les tâches. Chaque `desc` décrit la QUALITÉ de la performance à ce niveau (ce que l'élève réussit, ce qui lui manque) en s'appuyant sur le type de tâches du critère. N'écris jamais « 7 tâches sur 10 ». Les descripteurs d'un même critère doivent être clairement différents d'un niveau à l'autre. Rédige d'abord Excellent, Satisfaisant et Insuffisant, puis les niveaux intermédiaires.",
      "5. La rétroaction d'une tâche (`feedback`) est affichée à l'élève quand la tâche n'a pas obtenu tous ses points : dis précisément quoi corriger ou revoir.",
      "6. Un critère = une seule qualité jugée. Une même erreur ne doit pas être pénalisée dans deux critères.",
      "7. En cas de doute (rattachement ambigu, points absents ou incohérents, question qui ne correspond à aucun critère), NE DEVINE PAS : fais ton meilleur choix et ajoute une ligne explicative dans `aValider`.",
    ],
    math: "Somme des `pts` des tâches = `weight` du critère. Somme des `weight` = total de l'examen. Les valeurs de `weight` et `pts` dans le gabarit (0) sont des substituts à remplacer.",
    levels: (n) =>
      `Garde exactement ces ${n} niveaux (mêmes \`label\`, \`minPct\` et \`maxPct\`) pour chaque critère. \`minPct\` est le pourcentage à partir duquel le niveau s'applique ; \`maxPct\` est la note proposée quand le correcteur clique sur le niveau. Seuls les \`desc\` sont à rédiger.`,
    partial: "Les points partiels sont permis : le correcteur peut donner à une tâche n'importe quelle note entre 0 et `pts`. Décris donc dans `feedback` ce qui est attendu pour obtenir tous les points.",
    noPartial: "Les tâches sont notées tout ou rien (réussie = `pts`, sinon 0).",
    feedback:
      "Rédige 5 messages de rétroaction globale (`feedbackMessages`), un par tranche de note. Ton encourageant, motivant, professionnel et respectueux. Tutoie l'élève. Ne copie jamais le texte d'instruction.",
    checks: [
      "Chaque critère de l'enseignant est présent, avec son titre exact.",
      "Chaque question de l'examen apparaît dans exactement une tâche (aucune oubliée, aucune en double).",
      "Les sommes de points concordent (tâches → critère → total de l'examen).",
      "Aucun descripteur ne compte des tâches, et deux niveaux d'un critère n'ont pas la même description.",
      "Tout ce qui est incertain est listé dans `aValider`.",
    ],
    exampleNote: "EXEMPLE DE LOGIQUE UNIQUEMENT : ne reprends ni son contenu ni ses points.",
    example: {
      criterion: "Installer et administrer les services d'infrastructure réseau",
      weight: 20,
      tasks: [
        ["Déploiement d'OPNsense et configuration adéquate des interfaces", 6, "Vérifie l'affectation WAN/LAN et les adresses des interfaces."],
        ["Règles de filtrage conformes à la politique demandée", 8, "Compare chaque règle à la politique et revois leur ordre."],
        ["Tests de connectivité documentés", 6, "Ajoute une capture ou une sortie de commande pour chaque test."],
      ],
      levelDesc: "Excellent : le pare-feu est fonctionnel et respecte entièrement la politique ; Insuffisant : le pare-feu n'est pas fonctionnel ou ne reflète pas la politique.",
    },
    title: "Nom du cours ou du sujet principal",
    taskTitle: "Titre de l'évaluation (examen, laboratoire, travail pratique)",
    criterionTitle: "Titre exact du critère de performance fourni par l'enseignant",
    competency: "Élément de compétence visé (si fourni)",
    taskLabel: "Tâche précise et vérifiable tirée de l'énoncé",
    taskFeedback: "Ce qu'il faut corriger ou revoir si cette tâche n'obtient pas tous ses points.",
    levelDesc: (label) => `Décris la qualité de la performance au niveau « ${label} » pour ce critère.`,
    feedbackMsg: "Message de rétroaction pour cette tranche de note (à rédiger).",
    toValidate: "Liste ici chaque point incertain à faire valider par l'enseignant.",
    repeatCriteria: "Ce gabarit montre UN critère en exemple : répète la même structure pour CHAQUE critère de l'enseignant.",
    providedWithCourse: (n, title) =>
      `Les ${n} compétences / critères de performance du cours « ${title} » sont déjà inclus dans ce gabarit (voir 'criteres_de_performance_du_cours' et 'template_a_remplir.criteria'). L'enseignant te fournit en plus son examen ou l'énoncé du travail avec les points de chaque question (OBLIGATOIRE), et éventuellement un corrigé, un barème ou des consignes. Si l'examen est absent, ne génère pas de grille : demande-le.`,
    courseStructure: (n) =>
      `Le gabarit contient déjà ${n} critères, un par compétence du cours, dans cet ordre. Garde leur titre, leur \`competencyElement\` et leur \`competencyId\` (s'il est présent) tels quels et ne les supprime pas. Remplis pour chacun : \`weight\`, les tâches (\`subCriteria\`, à répéter autant que nécessaire) et les \`desc\` des niveaux. Si l'examen ne touche pas une compétence, laisse-la avec \`weight\` à 0 et signale-le dans \`aValider\`.`,
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
      "2. Tasks (`subCriteria`) are the concrete, verifiable part: each question or instruction in the exam becomes a task attached to the criterion it helps judge (e.g. \"Deploy OPNsense and configure the interfaces correctly\"). A task belongs to ONE criterion only. If a question covers two criteria, split it into two tasks (e.g. \"Q12a …\", \"Q12b …\") with their own points.",
      "3. Points live in tasks: `pts` is the task's maximum. The sum of task `pts` in a criterion = the criterion's `weight`. The sum of all `weight` = the exam total (not necessarily 100).",
      "4. Performance levels summarise mastery of the criterion; they do not recount tasks. Each `desc` describes the QUALITY of performance at that level (what the student achieves, what is missing) based on the criterion's kind of tasks. Never write \"7 tasks out of 10\". Descriptors of one criterion must clearly differ from level to level. Write Excellent, Satisfactory and Insufficient first, then the intermediate levels.",
      "5. A task's `feedback` is shown to the student when the task did not get full points: say precisely what to fix or review.",
      "6. One criterion = one quality judged. The same mistake must not be penalised in two criteria.",
      "7. When in doubt (ambiguous mapping, missing or inconsistent points, a question matching no criterion), DO NOT GUESS: make your best choice and add an explanatory line in `aValider`.",
    ],
    math: "Sum of task `pts` = criterion `weight`. Sum of `weight` = exam total. The `weight` and `pts` values in the template (0) are placeholders to replace.",
    levels: (n) =>
      `Keep exactly these ${n} levels (same \`label\`, \`minPct\`, \`maxPct\`) for every criterion. \`minPct\` is the percentage from which the level applies; \`maxPct\` is the suggested score when the grader clicks the level. Only the \`desc\` fields are yours to write.`,
    partial: "Partial points are allowed: the grader can give a task any score between 0 and `pts`. Describe in `feedback` what is expected to earn full points.",
    noPartial: "Tasks are all-or-nothing (done = `pts`, otherwise 0).",
    feedback:
      "Write 5 global feedback messages (`feedbackMessages`), one per score band. Encouraging, motivating, professional and respectful tone. Never copy instruction text.",
    checks: [
      "Every teacher criterion is present with its exact title.",
      "Every exam question appears in exactly one task (none missing, none duplicated).",
      "Point sums match (tasks → criterion → exam total).",
      "No descriptor counts tasks, and no two levels of a criterion share the same description.",
      "Anything uncertain is listed in `aValider`.",
    ],
    exampleNote: "LOGIC EXAMPLE ONLY: do not reuse its content or points.",
    example: {
      criterion: "Install and administer network infrastructure services",
      weight: 20,
      tasks: [
        ["Deploy OPNsense and configure the interfaces correctly", 6, "Check the WAN/LAN assignment and interface addresses."],
        ["Filtering rules matching the requested policy", 8, "Compare each rule with the policy and review their order."],
        ["Documented connectivity tests", 6, "Add a screenshot or command output for each test."],
      ],
      levelDesc: "Excellent: the firewall works and fully follows the policy; Insufficient: the firewall does not work or does not reflect the policy.",
    },
    title: "Course or main topic",
    taskTitle: "Assessment title (exam, lab, practical work)",
    criterionTitle: "Exact title of the performance criterion provided by the teacher",
    competency: "Targeted competency element (if provided)",
    taskLabel: "Precise, verifiable task taken from the exam",
    taskFeedback: "What to fix or review if this task does not get full points.",
    levelDesc: (label) => `Describe the quality of performance at the "${label}" level for this criterion.`,
    feedbackMsg: "Feedback message for this score band (to write).",
    toValidate: "List here each uncertain point for the teacher to validate.",
    repeatCriteria: "This template shows ONE example criterion: repeat the same structure for EACH teacher criterion.",
    providedWithCourse: (n, title) =>
      `The ${n} competencies / performance criteria of the course "${title}" are already included in this template (see 'criteres_de_performance_du_cours' and 'template_a_remplir.criteria'). The teacher additionally provides the exam or assignment text with the points of each question (REQUIRED), and optionally an answer key, a marking scheme or instructions. If the exam is missing, do not generate a rubric: ask for it.`,
    courseStructure: (n) =>
      `The template already contains ${n} criteria, one per course competency, in this order. Keep their title, \`competencyElement\` and \`competencyId\` (when present) unchanged and do not remove them. For each one fill in: \`weight\`, the tasks (\`subCriteria\`, repeated as needed) and the level \`desc\` fields. If the exam does not touch a competency, leave it with \`weight\` 0 and mention it in \`aValider\`.`,
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
    const exact = [T.title, T.taskTitle, T.criterionTitle, T.competency, T.taskFeedback, T.feedbackMsg, T.toValidate];
    if (exact.some((x) => t === String(x).trim().toLowerCase())) return true;
    if (t.startsWith(String(T.taskLabel).trim().toLowerCase())) return true; // « Tâche précise… 1 »
    return Object.values(LEVEL_SCALES)
      .flat()
      .some((lvl) => t === T.levelDesc(lvl.label).trim().toLowerCase());
  });
}
