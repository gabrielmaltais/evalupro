/** Évaluation fictive pour l'aperçu des réglages du PDF. */
function levels(descs) {
  const base = [["Insuffisant", 0, 0.3], ["Partiel", 0.6, 0.68], ["Satisfaisant", 0.75, 0.82], ["Excellent", 0.9, 1]];
  return base.map(([label, minPct, maxPct], i) => ({ label, minPct, maxPct, desc: descs[i] }));
}

function sampleEvaluation() {
  const task = (id, group, label, pts, feedback, checks, insight, expected) => ({
    id, group, label, pts, feedback, checks, insight,
    levels: levels(["Non réalisé.", "Réalisé en partie.", "Réalisé avec quelques imprécisions.", expected]),
  });
  const tasks = [
    task("s1", "Étape 1 : Configuration", "Adressage IP du serveur et du poste", 2, "", ["l'adresse est incorrecte", "le masque est incorrect"], "", "Adresses et masques conformes, visibles dans la capture."),
    task("s2", "Étape 1 : Configuration", "Redirecteur DNS vers le serveur reçu par la carte Internet", 2, "", ["le redirecteur est absent", "le redirecteur pointe vers un mauvais serveur"], "Le redirecteur DNS permet au serveur de transmettre à un serveur externe les noms qu'il ne sait pas résoudre; sans lui, seuls les noms locaux sont résolus.", "Redirecteur pointant vers le serveur DNS reçu, prouvé par la capture."),
    task("s3", "Étape 1 : Configuration", "Installation du rôle demandé", 1, "", [], "", "Rôle installé avec les services demandés."),
    task("s4", "Étape 2 : Services", "Pool d'adresses de la plage demandée", 2, "", ["la plage est différente de celle demandée", "l'adaptateur est incorrect"], "", "Pool conforme à la plage et à l'adaptateur demandés."),
    task("s5", "Étape 2 : Services", "Authentification sécurisée activée", 1.5, "", [], "", "Méthode sécurisée activée."),
    task("s6", "Étape 2 : Services", "Tests de connectivité documentés", 1.5, "", ["un test est absent", "une capture est manquante"], "", "Tous les tests demandés sont réussis et captés."),
  ];
  const rubric = {
    title: "Cours de démonstration",
    taskTitle: "Laboratoire - Exemple",
    feedbackMessages: [
      { minPct: 0, maxPct: 60, message: "Ce travail demande encore de la consolidation. Reprends les notions clés et viens poser tes questions." },
      { minPct: 60, maxPct: 75, message: "Tu as réalisé une partie importante du travail, mais certaines étapes comportent des lacunes." },
      { minPct: 75, maxPct: 85, message: "Bon travail ! L'essentiel fonctionne; quelques détails sont à peaufiner." },
      { minPct: 85, maxPct: 95, message: "Très bon travail, solide et bien justifié. Continue ainsi !" },
      { minPct: 95, maxPct: 100, message: "Excellent travail, rigoureux et précis. Félicitations !" },
    ],
    criteria: [{ id: "c1", title: "Installer et administrer les services", weight: 10, levels: levels(["", "", "", ""]), subCriteria: tasks }],
  };
  const evaluation = {
    studentName: "Camille Tremblay",
    date: new Date().toISOString().slice(0, 10),
    generalComment: "Beau travail dans l'ensemble, continue ainsi.",
    scores: { c1: 7.75 },
    comments: {},
    subScores: { c1: { s1: 1.5, s2: 0.5, s3: 1, s4: 1.75, s5: 1.5, s6: 1.5, _manques: { s1: ["le masque est incorrect"], s2: ["le redirecteur pointe vers un mauvais serveur"], s4: ["la plage est différente de celle demandée"] } } },
  };
  return { evaluation, rubric };
}

module.exports = { sampleEvaluation };
