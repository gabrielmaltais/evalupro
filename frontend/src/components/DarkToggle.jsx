import { useTheme } from "../lib/ThemeContext";

export default function DarkToggle({ className = "" }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={dark ? "Mode clair" : "Mode sombre"}
      className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 ${
        dark
          ? "bg-white/10 hover:bg-white/20 text-yellow-300"
          : "bg-gray-100 hover:bg-gray-200 text-gray-600"
      } ${className}`}
    >
      <i className={`fa-solid ${dark ? "fa-sun" : "fa-moon"} text-sm`}></i>
    </button>
  );
}
