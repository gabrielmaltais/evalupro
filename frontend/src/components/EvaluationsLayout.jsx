import { Outlet } from "react-router-dom";
import EvaluationsTabStrip from "./EvaluationsTabStrip";

/** Barre d’onglets unique (corriger / suivi / envois / grilles), puis la page active. */
export default function EvaluationsLayout() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <EvaluationsTabStrip />
      <Outlet />
    </div>
  );
}
