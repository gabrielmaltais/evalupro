/** Titre de page dans la zone de contenu (sous la barre d’application fixe). */
export default function PageSectionTitle({
  icon = "fa-circle",
  iconBgClass = "bg-blue-600",
  title,
  subtitle,
  className = "",
}) {
  return (
    <div className={`mb-6 sm:mb-8 ${className}`}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`${iconBgClass} text-white p-2.5 sm:p-3 rounded-2xl shadow-sm shrink-0`}>
          <i className={`fa-solid ${icon} text-lg sm:text-xl`} aria-hidden />
        </div>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{title}</h1>
          {subtitle != null && subtitle !== "" && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
