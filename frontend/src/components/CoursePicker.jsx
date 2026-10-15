import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const label = (c) => `${c.code ? `${c.code} · ` : ""}${c.title}`;

/**
 * Choix d'un cours qui reste compact quel que soit leur nombre: un bouton montre le cours choisi, il ouvre une
 * liste défilante avec recherche (titre ou code). Se ferme au choix, à Échap ou en cliquant ailleurs.
 */
export default function CoursePicker({ courses, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef(null);
  const current = courses.find((c) => c._id === value) || null;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !box.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return courses.filter((c) => !k || label(c).toLowerCase().includes(k));
  }, [courses, q]);

  if (courses.length === 0) {
    return (
      <p className="ui-info text-xs text-gray-600">
        Aucun cours : <Link to="/ressources/cours" className="font-semibold text-blue-600 underline">crée-en un d&apos;abord</Link>.
      </p>
    );
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQ(""); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
          current ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-900" : "border-gray-300 bg-white text-gray-500"
        } hover:border-emerald-500`}
      >
        <i className="fa-solid fa-book shrink-0 text-emerald-600" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{current ? label(current) : "Choisir le cours…"}</span>
        <i className={`fa-solid fa-chevron-down shrink-0 text-xs text-gray-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700">
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Rechercher parmi ${courses.length} cours…`}
            className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <ul role="listbox" className="max-h-60 space-y-0.5 overflow-y-auto">
            {shown.map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c._id === value}
                  onClick={() => { onChange(c._id); setOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-50 ${c._id === value ? "bg-emerald-50 font-semibold text-emerald-900" : "text-gray-800"}`}
                >
                  <span className="min-w-0 flex-1 truncate">{label(c)}</span>
                  <span className="shrink-0 text-xs text-gray-400">{(c.competencies || []).length} compétence(s)</span>
                  {c._id === value && <i className="fa-solid fa-check text-emerald-600" aria-hidden />}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">Aucun cours ne correspond.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
