import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUserFromToken } from "../lib/api";
import DarkToggle from "../components/DarkToggle";

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  
  // Single Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [group, setGroup] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [studentEvals, setStudentEvals] = useState([]);

  // Bulk Form State
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    try {
      const data = await api.listStudents();
      setStudents(data);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function selectStudent(s) {
    setSelectedId(s._id);
    setName(s.name || "");
    setEmail(s.email || "");
    setGroup(s.group || "");
    setBulkMode(false);
    setError("");
    setSuccess("");
    setConfirmDelete(false);
    
    try {
      const result = await api.listEvaluationsByStudent(s._id);
      setStudentEvals(result.items || []);
    } catch (e) {
      setStudentEvals([]);
    }
  }

  async function removeEval(evalId) {
    if (!window.confirm("Supprimer cette évaluation ?")) return;
    try {
      await api.deleteEvaluation(evalId);
      setStudentEvals(studentEvals.filter(e => e._id !== evalId));
    } catch(e) {
      alert("Erreur lors de la suppression.");
    }
  }

  function startNew() {
    setSelectedId(null);
    setName("");
    setEmail("");
    setGroup("");
    setBulkMode(false);
    setError("");
    setSuccess("");
    setConfirmDelete(false);
    setStudentEvals([]);
  }

  function startBulk() {
    startNew();
    setBulkMode(true);
  }

  async function save() {
    setError("");
    setSuccess("");
    try {
      if (selectedId) {
        await api.updateStudent(selectedId, { name, email, group });
        setSuccess("Étudiant modifié avec succès !");
      } else {
        const newStudent = await api.createStudent({ name, email, group });
        setSelectedId(newStudent._id);
        setSuccess("Nouvel étudiant ajouté avec succès !");
      }
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function saveBulk() {
    setError("");
    setSuccess("");
    try {
      const names = bulkText.split('\n').map(n => n.trim()).filter(n => n);
      if (names.length === 0) return setError("La liste est vide.");
      const toSend = names.map(n => ({ name: n, group }));
      await api.createStudentsBulk({ students: toSend });
      setSuccess(`${names.length} étudiants ajoutés avec succès au groupe "${group || 'Sans groupe'}" !`);
      setBulkMode(false);
      setBulkText("");
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function removeStudent() {
    if (!selectedId) return;
    try {
      await api.deleteStudent(selectedId);
      startNew();
      await refresh();
      setSuccess("Étudiant supprimé avec succès !");
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  // Grouping students
  const groupedStudents = students.reduce((acc, s) => {
    const g = s.group || "Sans groupe";
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});

  // Sort groups alphabetically, but force "Sans groupe" at the end if we want, or just sort keys
  const groupKeys = Object.keys(groupedStudents).sort();

  return (
    <div className="bg-gray-100 min-h-screen text-gray-800 font-sans flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 truncate mr-2">
                <div className="bg-gray-800 text-white p-1.5 sm:p-2 rounded-lg flex-shrink-0">
                    <i className="fa-solid fa-users text-lg sm:text-xl"></i>
                </div>
                <div className="min-w-0">
                    <h1 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight truncate">Gestion des Étudiants</h1>
                    <p className="hidden sm:block text-xs text-gray-500 font-medium uppercase tracking-wide">Liste de classe & Groupes</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
                <Link to="/evaluations" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center">
                    <i className="fa-solid fa-arrow-left sm:mr-2"></i><span className="hidden sm:inline">Retour aux évaluations</span>
                </Link>
                {getUserFromToken()?.role === "admin" && (
                  <Link to="/admin/users" className="p-1.5 sm:p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-full transition-colors sm:ml-2" title="Gestion des Utilisateurs">
                      <i className="fa-solid fa-user-shield text-lg"></i>
                  </Link>
                )}
                <DarkToggle />
                <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("eval_token"); window.location.href="/login"; }} className="p-1.5 sm:p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors sm:ml-2" title="Se déconnecter">
                    <i className="fa-solid fa-right-from-bracket text-lg"></i>
                </button>
            </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* LEFT COLUMN: List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={startNew} className="bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 font-medium py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-sm">
                <i className="fa-solid fa-user-plus"></i> <span className="hidden sm:inline">Ajouter</span>
            </button>
            <button type="button" onClick={startBulk} className="bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 font-medium py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-sm">
                <i className="fa-solid fa-file-import"></i> <span className="hidden sm:inline">Importer</span>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <h3 className="bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 border-b border-gray-100">Groupes ({students.length} cibles)</h3>
            <div className="max-h-[70vh] overflow-y-auto">
              {groupKeys.length === 0 && <div className="p-4 text-sm text-gray-500 text-center">Aucun étudiant.</div>}
              
              {groupKeys.map(g => (
                <div key={g} className="mb-2">
                  <div className="bg-gray-100 px-4 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wider sticky top-0">
                    {g} ({groupedStudents[g].length})
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {groupedStudents[g].map(s => (
                      <li key={s._id}>
                        <button type="button" onClick={() => selectStudent(s)} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${selectedId === s._id && !bulkMode ? 'bg-blue-50 border-l-4 border-blue-500' : 'pl-5'}`}>
                          <div className="font-semibold text-sm text-gray-800">{s.name}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Editor */}
        <div className="lg:col-span-3 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100"><i className="fa-solid fa-circle-exclamation mr-2"></i>{error}</div>}
          {success && <div className="bg-green-50 text-green-600 p-4 rounded-lg text-sm border border-green-100"><i className="fa-solid fa-check mr-2"></i>{success}</div>}

          {bulkMode ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Importation Multiple (Liste / Fichier)</h2>
              <p className="text-sm text-gray-500 mb-6">Copiez-collez une liste de noms d'étudiants (un par ligne) pour les ajouter rapidement à un groupe spécifique.</p>
              <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Classe / Groupe Cible</label>
                    <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ex: Groupe 101" value={group} onChange={e => setGroup(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1">Tous les étudiants ci-dessous seront assignés à ce groupe.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Liste des noms (un par ligne)</label>
                    <textarea rows="8" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm" placeholder="Jean Dupont&#10;Marie Tremblay&#10;Lucie Martin..." value={bulkText} onChange={e => setBulkText(e.target.value)}></textarea>
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200 pt-6 flex justify-end">
                  <button type="button" onClick={saveBulk} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-8 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2">
                      <i className="fa-solid fa-file-import"></i> Importer ces étudiants
                  </button>
              </div>
            </div>
          ) : (
            <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">{selectedId ? "Modifier l'étudiant" : "Nouvel étudiant"}</h2>
              <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                    <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Jean Tremblay" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Classe / Groupe (Optionnel)</label>
                    <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Gr1" value={group} onChange={e => setGroup(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optionnel)</label>
                    <input type="email" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="jean@exemple.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200 pt-6 flex justify-between items-center">
                  {selectedId ? (
                      confirmDelete ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-red-600">Confirmer ?</span>
                          <button type="button" onClick={removeStudent} className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                              Oui, supprimer
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-all">
                              Annuler
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelete(true)} className="text-red-500 hover:text-red-700 font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                            <i className="fa-solid fa-trash"></i> Supprimer
                        </button>
                      )
                  ) : (
                      <div></div>
                  )}
                  <button type="button" onClick={save} className="bg-gray-900 hover:bg-black text-white font-medium py-3 px-8 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2">
                      <i className="fa-solid fa-save"></i> Enregistrer
                  </button>
              </div>
            </div>
            
            {/* Historique des Notes */}
            {selectedId && !bulkMode && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4"><i className="fa-solid fa-history mr-2 text-blue-500"></i>Dossier d'Évaluations</h3>
                {studentEvals.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Aucune évaluation enregistrée pour cet étudiant.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {studentEvals.map(ev => (
                      <li key={ev._id} className="py-4 border-b border-gray-50 flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold text-gray-800">{ev.rubric?.title || 'Grille Supprimée'}</p>
                            <p className="text-xs text-gray-500">{ev.date} • {ev.rubric?.taskTitle || ''}</p>
                          </div>
                          <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${ev.totalScore / ev.totalMax >= 0.6 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {ev.totalScore} / {ev.totalMax}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end mt-2">
                           <Link to={`/evaluations?load=${ev._id}`} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-md border border-blue-200 transition-colors flex items-center gap-1 shadow-sm"><i className="fa-solid fa-eye"></i> Voir</Link>
                           <Link to={`/evaluations?load=${ev._id}&download=true`} className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-md border border-gray-200 transition-colors flex items-center gap-1 shadow-sm"><i className="fa-solid fa-file-pdf"></i> Télécharger PDF</Link>
                           <button onClick={() => removeEval(ev._id)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-md border border-red-200 transition-colors flex items-center gap-1 shadow-sm"><i className="fa-solid fa-trash"></i> Supprimer</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
          )}
        </div>
      </main>
    </div>
  );
}
