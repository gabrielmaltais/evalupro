import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useSession } from "../lib/sessionState";
import PageSectionTitle from "../components/PageSectionTitle";
import { Card, FormCard, btnDanger, btnPrimary, btnSecondary } from "../components/ui";

const input = "w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-800";
const EMPTY = { _id: null, name: "", color: "" };

/**
 * Groupes communs: ils existent une fois et se retrouvent dans chaque session. Les cours et les élèves,
 * eux, s'associent à chaque session (Session en cours > Cours et évaluations / Groupes et élèves).
 */
export default function ResourceGroups() {
  const { active } = useSession();
  const [groups, setGroups] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setGroups(await api.listCommonGroups());
    } catch (e) {
      setError(String(e.message || e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(fn) {
    setError("");
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      setError(String(e.message || e));
      return false;
    }
  }

  async function save() {
    const payload = { name: editing.name.trim(), color: editing.color || "" };
    if (!payload.name) return setError("Le nom du groupe est requis.");
    const ok = await act(() => (editing._id ? api.updateCommonGroup(editing._id, payload) : api.createCommonGroup(payload)));
    if (ok) setEditing(null);
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageSectionTitle
        icon="fa-users"
        iconBgClass="bg-blue-600"
        title="Mes groupes"
        subtitle="Un groupe existe une fois et se retrouve dans chaque session. À chaque session, tu lui associes ses cours (Cours et évaluations) et ses élèves."
        className="!mb-0"
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {editing ? (
        <FormCard mode={editing._id ? "Modification" : "Nouveau groupe"} title={editing._id ? editing.name || "Groupe" : "Nom et couleur du groupe"} onBack={() => setEditing(null)} backLabel="Mes groupes">
          <div className="grid gap-3 sm:grid-cols-[2fr_auto_auto] sm:items-end">
            <label>
              <span className="ui-label">Nom</span>
              <input autoFocus className={input} placeholder="Ex : 420-AB1" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label>
              <span className="ui-label">Couleur</span>
              <input type="color" className="h-10 w-16 rounded border border-gray-300" value={editing.color || "#2563eb"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
            </label>
            <button type="button" className={btnPrimary} onClick={save}>Enregistrer</button>
          </div>
          {editing._id && <p className="ui-info text-xs text-gray-600">Le nouveau nom s'applique au groupe dans toutes ses sessions.</p>}
        </FormCard>
      ) : (
        <button type="button" className={btnPrimary} onClick={() => setEditing(EMPTY)}>
          <i className="fa-solid fa-plus mr-1" aria-hidden /> Nouveau groupe
        </button>
      )}

      {groups.length === 0 && <p className="ui-info text-sm">Aucun groupe pour l'instant.</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <Card
            key={g._id}
            title={<><span className="inline-block h-3 w-3 rounded-full" style={{ background: g.color || "#94a3b8" }} aria-hidden /> {g.name}</>}
            actions={
              <>
                <button type="button" className={`${btnSecondary} !px-2 !py-1 text-xs`} onClick={() => setEditing({ _id: g._id, name: g.name, color: g.color })}>Modifier</button>
                {g.sessions.length === 0 && (
                  <button type="button" className={`${btnDanger} !px-2 !py-1 text-xs`} onClick={() => window.confirm(`Supprimer « ${g.name} » ?`) && act(() => api.deleteCommonGroup(g._id))}>
                    Supprimer
                  </button>
                )}
              </>
            }
          >
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {g.sessions.length ? `Sessions : ${g.sessions.map((s) => s.name).join(", ")}` : "Pas encore utilisé dans une session."}
            </p>
            {active && !g.activeGroup && !active.archivedAt && (
              <button type="button" className={`${btnSecondary} mt-3 text-xs`} onClick={() => act(() => api.createGroup({ name: g.name }))}>
                <i className="fa-solid fa-plus mr-1" aria-hidden /> Ajouter à la session « {active.name} »
              </button>
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}
