import { NavLink } from "react-router-dom";
import { getUserFromToken } from "../lib/api";

export default function TopPageMenu({ inHeader = false }) {
  const role = getUserFromToken()?.role;
  const links = [
    { to: "/evaluations", label: "Évaluations", icon: "fa-graduation-cap" },
    { to: "/admin/students", label: "Hub", icon: "fa-people-group" },
    { to: "/admin/rubrics", label: "Grilles", icon: "fa-sliders" },
    { to: "/account", label: "Mon compte", icon: "fa-user-gear" },
  ];

  if (role === "admin") {
    links.push({ to: "/admin/users", label: "Administration", icon: "fa-screwdriver-wrench" });
  }

  return (
    <nav className={inHeader ? "" : "bg-white border-b border-gray-100"}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${inHeader ? "py-2" : "py-2"} flex flex-wrap gap-2`}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition ${
                isActive
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`
            }
          >
            <i className={`fa-solid ${l.icon}`}></i>
            <span>{l.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
