import { useLocation } from "react-router-dom";
import TabStrip from "./TabStrip";

/** Section « Évaluations » : tout ce qui est actif et en cours (correction, suivi, envois, grilles). */
export default function EvaluationsTabStrip() {
  const location = useLocation();
  const isGrilles = location.pathname === "/evaluations/grilles";
  const tabParam = new URLSearchParams(location.search).get("tab");
  const activeEval = tabParam === "suivi" || tabParam === "envois" ? tabParam : "corriger";
  const tabs = [
    { id: "corriger", label: "Corriger", icon: "fa-pen-to-square", to: "/evaluations?tab=corriger" },
    { id: "suivi", label: "Suivi d'évaluation", icon: "fa-list-check", to: "/evaluations?tab=suivi" },
    { id: "envois", label: "Envois", icon: "fa-paper-plane", to: "/evaluations?tab=envois" },
    { id: "grilles", label: "Grilles", icon: "fa-sliders", to: "/evaluations/grilles" },
  ].map((t) => ({ ...t, active: t.id === "grilles" ? isGrilles : !isGrilles && activeEval === t.id }));
  return <TabStrip tabs={tabs} label="Évaluations" />;
}
