import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

const DEFAULT_CRITERION = {
  id: "cx",
  title: "Nouveau Critère",
  weight: 10,
  color: "border-blue-500",
  levels: [
    { label: "Insatisfaisant", maxPct: 0.5, desc: "Description..." },
    { label: "Bon", maxPct: 0.8, desc: "Description..." },
    { label: "Excellent", maxPct: 1, desc: "Description..." }
  ]
};

export default function AdminRubric() {
  const [rubrics, setRubrics] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  
  // Form State
  const [title, setTitle] = useState("Nouvelle Grille");
  const [taskTitle, setTaskTitle] = useState("Tâche Finale");
  const [version, setVersion] = useState(1);
  const [criteria, setCriteria] = useState([{ ...DEFAULT_CRITERION, id: "c1" }]);
  const [isActive, setIsActive] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const DEFAULT_FEEDBACK = [
    { minPct: 0, maxPct: 60, message: "Tu n'y es pas encore, mais ne te décourage pas ! Reviens sur les points manquants, consulte tes notes et n'hésite pas à demander de l'aide. Tu as la capacité de progresser et c'est en persévérant qu'on réussit." },
    { minPct: 60, maxPct: 75, message: "C'est un début ! Tu as saisi les bases, mais certains éléments méritent d'être approfondis. Prends le temps de revoir les points manqués — tu es sur la bonne voie pour t'améliorer." },
    { minPct: 75, maxPct: 85, message: "Beau travail ! Tu démontres une bonne maîtrise de l'ensemble du sujet. Quelques détails peuvent encore être peaufinés, mais tu peux être fier·e de ta performance." },
    { minPct: 85, maxPct: 95, message: "Excellent travail ! Tu maîtrises très bien la matière et ton investissement est visible. Continue comme ça, tu t'approches de la perfection !" },
    { minPct: 95, maxPct: 100, message: "Extraordinaire ! 🎉 Tu as accompli un travail remarquable et exceptionnel. C'est le résultat d'un effort soutenu et d'une vraie rigueur. Félicitations sincères !" },
  ];
  const [feedbackMessages, setFeedbackMessages] = useState(DEFAULT_FEEDBACK);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    try {
      const data = await api.listRubrics();
      setRubrics(data);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function selectRubric(r) {
    setSelectedId(r._id);
    setTitle(r.title || "");
    setTaskTitle(r.taskTitle || "");
    setVersion((r.version || 1) + 1); // Auto increment version for new save
    setCriteria(r.criteria || []);
    setIsActive(r.isActive !== false);
    setFeedbackMessages(r.feedbackMessages && r.feedbackMessages.length > 0 ? r.feedbackMessages : DEFAULT_FEEDBACK);
    setError("");
    setSuccess("");
    setConfirmDelete(false);
  }

  function startNew() {
    setSelectedId(null);
    setTitle("Nouvelle Grille");
    setTaskTitle("Tâche");
    setVersion(1);
    setCriteria([{ ...DEFAULT_CRITERION, id: "c1" }]);
    setIsActive(true);
    setFeedbackMessages(DEFAULT_FEEDBACK);
    setError("");
    setSuccess("");
    setConfirmDelete(false);
  }

  async function save() {
    setError("");
    setSuccess("");
    try {
      if (selectedId) {
        await api.updateRubric(selectedId, { title, taskTitle, version, criteria, isActive, feedbackMessages });
        setSuccess("Grille modifiée avec succès !");
      } else {
        const newRubric = await api.createRubric({ title, taskTitle, version, criteria, isActive, feedbackMessages });
        setSelectedId(newRubric._id);
        setSuccess("Nouvelle grille créée avec succès !");
      }
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function removeRubric() {
    if (!selectedId) return;
    try {
      await api.deleteRubric(selectedId);
      startNew();
      await refresh();
      setSuccess("Grille supprimée avec succès !");
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  function updateCriterion(idx, field, value) {
    const newC = [...criteria];
    newC[idx] = { ...newC[idx], [field]: value };
    setCriteria(newC);
  }

  function updateLevel(cIdx, lIdx, field, value) {
    const newC = [...criteria];
    const newLevels = [...newC[cIdx].levels];
    newLevels[lIdx] = { ...newLevels[lIdx], [field]: value };
    newC[cIdx] = { ...newC[cIdx], levels: newLevels };
    setCriteria(newC);
  }

  function addCriterion() {
    setCriteria([...criteria, { ...DEFAULT_CRITERION, id: `c${Date.now()}` }]);
  }

  function removeCriterion(idx) {
    setCriteria(criteria.filter((_, i) => i !== idx));
  }

  function addLevel(cIdx) {
    const newC = [...criteria];
    const newLevels = [...(newC[cIdx].levels || [])];
    newLevels.push({ label: "Nouveau", maxPct: 1, desc: "" });
    newC[cIdx] = { ...newC[cIdx], levels: newLevels };
    setCriteria(newC);
  }

  function removeLevel(cIdx, lIdx) {
    const newC = [...criteria];
    const newLevels = [...newC[cIdx].levels];
    newLevels.splice(lIdx, 1);
    newC[cIdx] = { ...newC[cIdx], levels: newLevels };
    setCriteria(newC);
  }

  function addSC(cIdx) {
    const newC = [...criteria];
    const newSC = [...(newC[cIdx].subCriteria || [])];
    newSC.push({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), label: 'Nouveau point technique', pts: 1 });
    newC[cIdx] = { ...newC[cIdx], subCriteria: newSC };
    setCriteria(newC);
  }

  function updateSC(cIdx, scIdx, field, val) {
    const newC = [...criteria];
    const newSC = [...(newC[cIdx].subCriteria || [])];
    newSC[scIdx] = { ...newSC[scIdx], [field]: val };
    newC[cIdx] = { ...newC[cIdx], subCriteria: newSC };
    setCriteria(newC);
  }

  function removeSC(cIdx, scIdx) {
    const newC = [...criteria];
    const newSC = [...(newC[cIdx].subCriteria || [])];
    newSC.splice(scIdx, 1);
    newC[cIdx] = { ...newC[cIdx], subCriteria: newSC };
    setCriteria(newC);
  }

  function exportJSON() {
    const data = { title, taskTitle, version, criteria, isActive };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `Grille_${(taskTitle || title || 'sans_titre').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim().replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadAITemplate() {
    const template = {
      "_INSTRUCTIONS_IA": "Ceci est un gabarit pour générer des grilles d'évaluation. Vous devez conserver cette structure JSON exacte. Ne modifiez pas la structure des champs 'title', 'weight', 'color', 'levels', 'maxPct', 'desc'.",
      "_DIRECTIVES_NIVEAUX": "Les 'levels' de performance (ex: Insatisfaisant, Bon, Excellent) sont des EXEMPLES. Vous DEVEZ adapter leur quantité et leurs noms au contexte. Si le laboratoire est très technique, on peut avoir juste 2 niveaux (ex: Échec/Réussite). Ajustez maxPct (0 à 1) selon le pourcentage visé.",
      "_DIRECTIVES_SOUS_CRITERES": "Optionnellement, on peut utiliser des cases à cocher de validation. Ajouter un tableau `subCriteria` avec `{label, pts, id, feedback}`. Le champ 'feedback' est le commentaire qui s'affiche lorsque la case N'EST PAS cochée (pour expliquer ce qui manque ou ce qui a été raté par l'étudiant).",
      "title": "Nom de ton cours ou du sujet principal",
      "taskTitle": "Titre spécifique de la tâche ou de l'examen",
      "criteria": [
        {
          "id": "c1",
          "title": "Nom du critère évalué (Ex: Présentation de la topologie)",
          "weight": 10,
          "_weight_comment": "Le nombre de points totaux pour ce critère",
          "color": "border-blue-500",
          "_color_options": "Doit être: border-blue-500, border-green-500, border-red-500, border-purple-500, border-orange-500, ou border-gray-500",
          "levels": [
            {
              "label": "Insuffisant / Non Fonctionnel",
              "maxPct": 0,
              "desc": "La configuration est absente ou ne fonctionne pas du tout."
            },
            {
              "label": "Partiel",
              "maxPct": 0.5,
              "desc": "La configuration est présente mais incomplète ou avec des erreurs."
            },
            {
              "label": "Excellent / Complet",
              "maxPct": 1,
              "desc": "La consigne est complétée à 100% avec les bonnes pratiques appliquées."
            }
          ],
          "subCriteria": [
            {
              "id": "sc1",
              "label": "Tâche technique spécifique (ex: Ping fonctionnel)",
              "pts": 2.5,
              "feedback": "Le ping entre les machines n'est pas fonctionnel. Vérifiez l'adressage IP et la configuration du pare-feu."
            },
            {
              "id": "sc2",
              "label": "Respect des conventions de nommage",
              "pts": 1,
              "feedback": "Les conventions de nommage ne sont pas respectées. Revoyez les noms des machines, comptes et OU."
            }
          ],
          "_feedback_comment": "Le champ 'feedback' s'affiche quand la case N'EST PAS cochée. Il explique à l'étudiant ce qui lui manque ou ce qu'il a raté. Rédigez-le comme un retour constructif."
        }
      ]
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `Gabarit_Intelligence_Artificielle.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        if (json.criteria && Array.isArray(json.criteria)) {
          setTitle(json.title || json.courseTitle || "Grille Importée");
          setTaskTitle(json.taskTitle || "Travail Final");
          setCriteria(json.criteria);
          setVersion(1);
          setSelectedId(null);
          setSuccess("Grille importée ! Modifiez-la si besoin, puis Enregistrez.");
          setError("");
        } else {
          setError("Le fichier JSON ne contient pas de critères valides.");
        }
      } catch (err) {
        setError("Erreur de lecture du fichier JSON.");
      }
      e.target.value = null; // reset input
    };
    reader.readAsText(file);
  }

  const totalPoints = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  return (
    <div className="bg-gray-100 min-h-screen text-gray-800 font-sans flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="bg-gray-800 text-white p-2 rounded-lg">
                    <i className="fa-solid fa-sliders text-xl"></i>
                </div>
                <div>
                    <h1 className="text-lg font-bold text-gray-900 leading-tight">Administration des Grilles</h1>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Configuration</p>
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                <Link to="/evaluations" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                    <i className="fa-solid fa-arrow-left mr-2"></i>Retour aux évaluations
                </Link>
                <button onClick={() => { localStorage.removeItem("eval_token"); window.location.href="/login"; }} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors ml-4" title="Se déconnecter">
                    <i className="fa-solid fa-right-from-bracket text-lg"></i>
                </button>
            </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* LEFT COLUMN: List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={startNew} className="flex-1 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 font-medium py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm">
                <i className="fa-solid fa-plus"></i> <span className="hidden xl:inline">Nouvelle</span>
            </button>
            <label className="bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center cursor-pointer text-sm" title="Importer depuis JSON">
                <i className="fa-solid fa-upload"></i>
                <input type="file" className="hidden" accept=".json" onChange={handleImportJSON} />
            </label>
            <button onClick={exportJSON} className="bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center text-sm shadow-sm" title="Exporter en JSON">
                <i className="fa-solid fa-download"></i>
            </button>
            <button onClick={downloadAITemplate} className="bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center text-sm shadow-sm" title="Gabarit vierge avec instructions pour l'IA">
                <i className="fa-solid fa-robot"></i>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <h3 className="bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 border-b border-gray-100">Grilles Enregistrées</h3>
            <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {rubrics.map(r => (
                <li key={r._id}>
                  <button type="button" onClick={() => selectRubric(r)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedId === r._id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                    <div className="font-semibold text-sm text-gray-800 line-clamp-2">{r.taskTitle || r.title || 'Nouvelle Grille'}</div>
                    <div className="text-xs text-gray-500 flex justify-between mt-1 items-center">
                      <span className="truncate pr-2" title={r.title}>{r.title} (v{r.version})</span>
                      {r.isActive && <span className="text-green-500 font-medium flex-shrink-0">Active</span>}
                    </div>
                  </button>
                </li>
              ))}
              {rubrics.length === 0 && <li className="p-4 text-sm text-gray-500 text-center">Aucune grille.</li>}
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN: Editor */}
        <div className="lg:col-span-3 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100"><i className="fa-solid fa-circle-exclamation mr-2"></i>{error}</div>}
          {success && <div className="bg-green-50 text-green-600 p-4 rounded-lg text-sm border border-green-100"><i className="fa-solid fa-check mr-2"></i>{success}</div>}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Paramètres Généraux</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre du Cours</label>
                  <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre du Travail (Tâche)</label>
                  <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Version (Sera enregistrée comme nouvelle)</label>
                  <input type="number" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={version} onChange={e => setVersion(Number(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Éditeur de Critères</h2>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Total : {totalPoints} pts</span>
                    <button type="button" onClick={addCriterion} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-2 text-sm">
                        <i className="fa-solid fa-plus"></i> Ajouter Critère
                    </button>
                </div>
            </div>

            <div className="space-y-6">
              {criteria.map((c, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative">
                  <button type="button" onClick={() => removeCriterion(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition"><i className="fa-solid fa-trash"></i></button>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 pr-8">
                    <div className="col-span-6">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Titre du critère</label>
                      <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none" value={c.title} onChange={e => updateCriterion(idx, 'title', e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Points (Poids)</label>
                      <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none" value={c.weight} onChange={e => updateCriterion(idx, 'weight', Number(e.target.value))} />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Couleur UI</label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none" value={c.color} onChange={e => updateCriterion(idx, 'color', e.target.value)}>
                        <option value="border-blue-500">Bleu</option>
                        <option value="border-green-500">Vert</option>
                        <option value="border-purple-500">Violet</option>
                        <option value="border-orange-500">Orange</option>
                        <option value="border-red-500">Rouge</option>
                        <option value="border-gray-500">Gris</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Niveaux de performance (Descripteurs)</label>
                        <button type="button" onClick={() => addLevel(idx)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded font-bold transition"><i className="fa-solid fa-plus"></i> Ajouter un niveau</button>
                    </div>
                    {c.levels?.map((l, lIdx) => (
                      <div key={lIdx} className="flex gap-2 items-start group">
                         <div className="w-32 flex-shrink-0">
                           <input type="text" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none bg-white font-semibold" value={l.label} onChange={e => updateLevel(idx, lIdx, 'label', e.target.value)} />
                         </div>
                         <div className="w-20 flex-shrink-0 relative">
                           <input type="number" step="0.1" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none bg-white" value={l.maxPct} onChange={e => updateLevel(idx, lIdx, 'maxPct', Number(e.target.value))} />
                           <span className="absolute right-2 top-1.5 text-xs text-gray-400">max</span>
                         </div>
                         <div className="flex-grow flex gap-2 items-start">
                           <textarea className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs outline-none bg-white" rows="2" value={l.desc} onChange={e => updateLevel(idx, lIdx, 'desc', e.target.value)}></textarea>
                           <button type="button" onClick={() => removeLevel(idx, lIdx)} className="text-red-400 hover:text-red-600 opacity-20 group-hover:opacity-100 transition p-1" title="Supprimer ce niveau"><i className="fa-solid fa-times"></i></button>
                         </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-4 mt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase">Sous-critères : Cases à cocher (Optionnel)</label>
                        <button type="button" onClick={() => addSC(idx)} className="text-xs bg-purple-50 text-purple-600 hover:bg-purple-100 px-2 py-1 rounded font-bold transition"><i className="fa-solid fa-plus"></i> Ajouter option</button>
                    </div>
                    {c.subCriteria?.map((sc, scIdx) => (
                      <div key={scIdx} className="space-y-1 group bg-purple-50/30 p-2 rounded-lg border border-purple-100">
                         <div className="flex gap-2 items-start">
                           <div className="flex-grow">
                             <input type="text" className="w-full px-2 py-1.5 border border-purple-200 focus:border-purple-400 rounded text-xs outline-none bg-white font-semibold" placeholder="Ex: L'enregistrement DNS est configuré" value={sc.label} onChange={e => updateSC(idx, scIdx, 'label', e.target.value)} />
                           </div>
                           <div className="w-20 flex-shrink-0 relative">
                             <input type="number" step="0.5" className="w-full px-2 py-1.5 border border-purple-200 focus:border-purple-400 rounded text-xs outline-none bg-white" value={sc.pts} onChange={e => updateSC(idx, scIdx, 'pts', Number(e.target.value))} />
                             <span className="absolute right-2 top-1.5 text-xs text-gray-400 font-bold">pts</span>
                           </div>
                           <div className="flex-shrink-0">
                             <button type="button" onClick={() => removeSC(idx, scIdx)} className="text-red-400 hover:text-red-600 opacity-20 group-hover:opacity-100 transition p-2" title="Supprimer ce sous-critère"><i className="fa-solid fa-times"></i></button>
                           </div>
                         </div>
                         <textarea className="w-full px-2 py-1 border border-purple-100 focus:border-purple-300 rounded text-xs outline-none bg-white text-gray-600" rows="1" placeholder="⚠ Feedback si non réussi (optionnel) — affiché quand cette case N'EST PAS cochée" value={sc.feedback || ''} onChange={e => updateSC(idx, scIdx, 'feedback', e.target.value)}></textarea>
                      </div>
                    ))}
                  </div>

                </div>
              ))}
            </div>

            {/* Feedback Messages Editor */}
            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-gray-700 uppercase"><i className="fa-solid fa-comment-dots mr-2 text-blue-500"></i>Rétroaction Finale (PDF)</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">Ces messages apparaîtront à la fin du document PDF selon le pourcentage obtenu par l'étudiant.</p>
              <div className="space-y-2">
                {feedbackMessages.map((fm, fmIdx) => {
                  const bgColor = fm.maxPct <= 40 ? 'border-l-red-400 bg-red-50/30' : fm.maxPct <= 60 ? 'border-l-orange-400 bg-orange-50/30' : fm.maxPct <= 80 ? 'border-l-yellow-400 bg-yellow-50/30' : fm.maxPct <= 90 ? 'border-l-blue-400 bg-blue-50/30' : 'border-l-green-400 bg-green-50/30';
                  return (
                    <div key={fmIdx} className={`flex gap-2 items-start p-2 rounded-lg border-l-4 ${bgColor}`}>
                      <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                        <input type="number" className="w-12 px-1 py-1 border border-gray-300 rounded text-xs outline-none text-center" value={fm.minPct} onChange={e => { const n = [...feedbackMessages]; n[fmIdx] = {...n[fmIdx], minPct: Number(e.target.value)}; setFeedbackMessages(n); }} />
                        <span className="text-xs text-gray-400">—</span>
                        <input type="number" className="w-12 px-1 py-1 border border-gray-300 rounded text-xs outline-none text-center" value={fm.maxPct} onChange={e => { const n = [...feedbackMessages]; n[fmIdx] = {...n[fmIdx], maxPct: Number(e.target.value)}; setFeedbackMessages(n); }} />
                        <span className="text-xs text-gray-400 font-bold">%</span>
                      </div>
                      <input type="text" className="flex-grow px-2 py-1 border border-gray-200 rounded text-xs outline-none" value={fm.message} onChange={e => { const n = [...feedbackMessages]; n[fmIdx] = {...n[fmIdx], message: e.target.value}; setFeedbackMessages(n); }} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6 flex justify-between items-center">
                {selectedId ? (
                    confirmDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-red-600">Confirmer ?</span>
                        <button type="button" onClick={removeRubric} className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                            Oui, supprimer
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-all">
                            Annuler
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(true)} className="text-red-500 hover:text-red-700 font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                          <i className="fa-solid fa-trash"></i> Supprimer cette Grille
                      </button>
                    )
                ) : (
                    <div></div>
                )}
                <button type="button" onClick={save} className="bg-gray-900 hover:bg-black text-white font-medium py-3 px-8 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2">
                    <i className="fa-solid fa-save"></i> Enregistrer cette Grille
                </button>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
