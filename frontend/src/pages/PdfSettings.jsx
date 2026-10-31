import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageSectionTitle from "../components/PageSectionTitle";

const SECTIONS = [
  {
    title: "Présentation",
    fields: [
      { key: "layout", type: "select", label: "Mise en page", options: [["compact", "Compact (1 à 2 pages)"], ["detaille", "Détaillé (une fiche par question ratée)"]] },
      { key: "pageSize", type: "select", label: "Format du papier", options: [["LETTER", "Lettre (8,5 × 11 po)"], ["A4", "A4"]] },
      { key: "palette", type: "select", label: "Couleurs", options: [["carnet", "Carnet (crème, vert, terracotta)"], ["ardoise", "Ardoise (bleu et sarcelle)"], ["bordeaux", "Bordeaux (sobre et chaud)"]] },
      { key: "showDate", type: "toggle", label: "Afficher la date de l'évaluation" },
      { key: "showPercent", type: "toggle", label: "Afficher le pourcentage de la note" },
      { key: "showPageNumbers", type: "toggle", label: "Numéroter les pages" },
    ],
  },
  {
    title: "Textes",
    help: "Variables permises : {etudiant} {prenom} {cours} {examen} {enseignant}",
    fields: [
      { key: "headerLabel", type: "text", label: "Étiquette en haut du document", placeholder: "Rapport de correction" },
      { key: "footerText", type: "text", label: "Texte du pied de page", placeholder: "Vide = « Étudiant / Cours »" },
      { key: "greeting", type: "select", label: "Salutation de la lettre finale", options: [["firstName", "Prénom de l'étudiant (« Camille, »)"], ["none", "Aucune"]] },
      { key: "signatureText", type: "text", label: "Signature de la lettre finale", placeholder: "Vide = aucune signature. Ex. : {enseignant}, enseignant" },
    ],
  },
  {
    title: "Contenu du rapport",
    fields: [
      { key: "showOpening", type: "toggle", label: "Mot d'ouverture écrit pour l'étudiant", hint: "Note, étape la plus solide et étape à travailler." },
      { key: "showHighlights", type: "toggle", label: "Encadrés « Ce que tu maîtrises / Où gagner des points »", hint: "Mise en page détaillée seulement." },
      { key: "showStepVerdict", type: "toggle", label: "Verdict écrit sous chaque étape" },
      { key: "listAllQuestions", type: "toggle", label: "Lister aussi les questions réussies", hint: "Décoché : seules les questions à revoir apparaissent." },
      { key: "showObservations", type: "toggle", label: "Observations cochées (« Ce que j'ai relevé »)" },
      { key: "showExpected", type: "toggle", label: "Ce qui était attendu" },
      { key: "showInsights", type: "toggle", label: "« Pour comprendre » (explications)" },
    ],
  },
  {
    title: "Fin du document",
    fields: [
      { key: "showFinalMessage", type: "toggle", label: "Message selon la note" },
      { key: "showPriorityHint", type: "toggle", label: "Phrase sur l'étape à travailler en premier" },
      { key: "showTeacherComment", type: "toggle", label: "Commentaire de l'enseignant" },
    ],
  },
];

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-gray-300 dark:bg-slate-600"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function PdfSettings() {
  const [settings, setSettings] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.getPdfSettings().then((r) => { setSettings(r.settings); setSaved(r.settings); setDefaults(r.defaults); }).catch((e) => setError(e.message));
  }, []);

  const dirty = settings && saved && JSON.stringify(settings) !== JSON.stringify(saved);
  const set = (key, value) => { setMessage(""); setSettings((s) => ({ ...s, [key]: value })); };

  async function save() {
    setBusy("save"); setError(""); setMessage("");
    try {
      const r = await api.savePdfSettings(settings);
      setSettings(r.settings); setSaved(r.settings); setMessage("Réglages enregistrés : ils s'appliquent aux PDF téléchargés et aux courriels.");
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  }

  async function preview() {
    setBusy("preview"); setError("");
    try {
      const blob = await api.previewPdfSettings(settings);
      window.open(URL.createObjectURL(blob), "_blank", "noopener");
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  }

  if (!settings) return <div className="p-8 text-center text-gray-500">{error || "Chargement…"}</div>;

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <PageSectionTitle icon="fa-file-pdf" iconBgClass="bg-rose-600" title="Paramètres du PDF de correction" subtitle="Ce que contient le document remis à l'étudiant. S'applique au téléchargement et à l'envoi par courriel." />
      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}

      <div className="space-y-6">
        {SECTIONS.map((sec) => (
          <section key={sec.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">{sec.title}</h2>
            {sec.help && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{sec.help}</p>}
            <div className="mt-3 divide-y divide-gray-100 dark:divide-white/10">
              {sec.fields.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <label className="min-w-0 flex-1 text-sm text-gray-800 dark:text-slate-100">
                    <span className="font-medium">{f.label}</span>
                    {f.hint && <span className="block text-xs text-gray-500 dark:text-slate-400">{f.hint}</span>}
                  </label>
                  {f.type === "toggle" && <Toggle checked={Boolean(settings[f.key])} onChange={(v) => set(f.key, v)} label={f.label} />}
                  {f.type === "select" && (
                    <select className={`${inputCls} sm:w-72`} value={settings[f.key]} onChange={(e) => set(f.key, e.target.value)} aria-label={f.label}>
                      {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  )}
                  {f.type === "text" && <input type="text" className={`${inputCls} sm:w-80`} value={settings[f.key]} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} aria-label={f.label} />}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-4 mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
        <button type="button" onClick={save} disabled={!dirty || busy === "save"} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">{busy === "save" ? "Enregistrement…" : "Enregistrer"}</button>
        <button type="button" onClick={preview} disabled={busy === "preview"} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">{busy === "preview" ? "Création…" : "Aperçu du PDF"}</button>
        <button type="button" onClick={() => { setMessage(""); setSettings(defaults); }} className="ml-auto text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-100">Rétablir les valeurs par défaut</button>
      </div>
    </main>
  );
}
