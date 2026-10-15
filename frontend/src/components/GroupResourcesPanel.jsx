import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

/** Inscription d'élèves existants dans un groupe (les cours s'associent dans Session en cours > Groupes). */
export default function GroupResourcesPanel({ groupId, onChanged }) {
  const [group, setGroup] = useState(null);
  const [library, setLibrary] = useState([]);
  const [error, setError] = useState("");
  const [pickStudent, setPickStudent] = useState("");

  const load = useCallback(async () => {
    try {
      const [g, lib] = await Promise.all([api.getGroup(groupId), api.listLibraryStudents()]);
      setGroup(g);
      setLibrary(lib);
      setError("");
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [groupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(fn) {
    setError("");
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  const enrolledIds = useMemo(() => new Set((group?.students || []).map((s) => String(s._id))), [group]);
  const outsiders = library.filter((s) => !enrolledIds.has(String(s._id)));

  if (!group) return error ? <p className="text-sm text-red-600">{error}</p> : null;

  const sel = "rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800";

  return (
    <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900/40">
      <h2 className="text-base font-bold">
        Élèves de <span className="text-blue-600 dark:text-blue-400">{group.name}</span>
      </h2>
      {error && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 ">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-gray-500">Inscrire un élève existant</p>
          {outsiders.length > 0 ? (
            <div className="flex gap-1.5">
              <select className={`${sel} min-w-0 flex-1`} value={pickStudent} onChange={(e) => setPickStudent(e.target.value)}>
                <option value="">Choisir une fiche…</option>
                {outsiders.map((s) => (
                  <option key={s._id} value={s._id}>{s.lastName ? `${s.lastName}, ${s.firstName || ""}` : s.name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!pickStudent}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                onClick={() => act(async () => { await api.enrollInGroup(groupId, { studentId: pickStudent }); setPickStudent(""); })}
              >
                Inscrire
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Toutes tes fiches sont déjà dans ce groupe. Pour une nouvelle personne, utilise « Ajouter » ci-dessous.</p>
          )}
          <p className="text-xs text-gray-500">Une fiche d'élève est permanente : elle te suit d'une session à l'autre.</p>
        </div>
      </div>
    </section>
  );
}
