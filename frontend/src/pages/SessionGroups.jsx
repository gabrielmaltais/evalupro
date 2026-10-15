import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useSession } from "../lib/sessionState";
import PageSectionTitle from "../components/PageSectionTitle";
import { Card, Chip, btnSecondary } from "../components/ui";

/**
 * Groupes de la session en cours: les groupes (et leurs élèves) se gèrent dans Ressources; ici on choisit
 * ceux de la session et on leur associe les cours de cette session.
 */
export default function SessionGroups() {
  const { active } = useSession();
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [g, c] = await Promise.all([api.listCommonGroups(), api.listCourses()]);
      setGroups(g);
      setCourses(c.filter((x) => !x.archivedAt));
      setError("");
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
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  const linked = (g, courseId) => (g.activeGroup?.courses || []).some((c) => String(c) === String(courseId));
  function toggleCourse(g, courseId) {
    const cur = g.activeGroup.courses || [];
    const next = linked(g, courseId) ? cur.filter((c) => String(c) !== String(courseId)) : [...cur, courseId];
    act(() => api.updateGroup(g.activeGroup._id, { courses: next }));
  }

  if (!active) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="ui-info text-sm">Crée ou choisis d'abord une session dans <Link to="/sessions" className="font-semibold text-blue-600 underline">Sessions</Link>.</p>
      </main>
    );
  }

  const inSession = groups.filter((g) => g.activeGroup);
  const others = groups.filter((g) => !g.activeGroup);
  const readOnly = Boolean(active.archivedAt);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageSectionTitle
        icon="fa-users-between-lines"
        iconBgClass="bg-blue-600"
        title="Groupes"
        subtitle={`Session : ${active.name}. Associe à chaque groupe ses cours de la session. Les groupes et leurs élèves se gèrent dans Ressources.`}
        className="!mb-0"
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {inSession.length === 0 && <p className="ui-info text-sm">Aucun groupe dans cette session pour l'instant.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {inSession.map((g) => (
          <Card key={g._id} title={<><span className="inline-block h-3 w-3 rounded-full" style={{ background: g.color || "#94a3b8" }} aria-hidden /> {g.name}</>}>
            <p className="mb-2 text-xs font-bold uppercase text-gray-500">Cours</p>
            {courses.length ? (
              <div className="flex flex-wrap gap-2">
                {courses.map((c) => (
                  <Chip key={c._id} icon="fa-book" active={linked(g, c._id)} onClick={() => !readOnly && toggleCourse(g, c._id)}>
                    {c.title}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Aucun cours. <Link to="/ressources/cours" className="text-blue-600 underline">Créer un cours</Link></p>
            )}
          </Card>
        ))}
      </div>

      {others.length > 0 && !readOnly && (
        <Card title="Ajouter un groupe à la session">
          <div className="flex flex-wrap gap-2">
            {others.map((g) => (
              <Chip key={g._id} icon="fa-plus" onClick={() => act(() => api.createGroup({ name: g.name }))}>{g.name}</Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">Ses élèves le suivent. Pour créer ou modifier un groupe : <Link to="/ressources/groupes" className="text-blue-600 underline">Ressources › Groupes et élèves</Link>.</p>
        </Card>
      )}
      {groups.length === 0 && (
        <Link to="/ressources/groupes" className={`${btnSecondary} inline-block`}>Créer un groupe dans Ressources</Link>
      )}
    </main>
  );
}
