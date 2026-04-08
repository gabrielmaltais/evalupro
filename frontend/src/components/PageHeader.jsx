import { Link } from "react-router-dom";
import DarkToggle from "./DarkToggle";

export default function PageHeader({
  icon = "fa-circle",
  iconBgClass = "bg-blue-600",
  title,
  subtitle,
  showBack = true,
  backTo = "/evaluations",
  backLabel = "Retour",
}) {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`${iconBgClass} text-white p-3 rounded-xl shadow`}>
            <i className={`fa-solid ${icon} text-xl`}></i>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{title}</h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {showBack && (
            <Link to={backTo} className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
              <i className="fa-solid fa-arrow-left mr-2"></i>
              {backLabel}
            </Link>
          )}
          <DarkToggle />
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("eval_token");
              window.location.href = "/login";
            }}
            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
            title="Se déconnecter"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </div>
    </header>
  );
}
