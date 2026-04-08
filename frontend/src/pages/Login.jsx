import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    // Client-side quick check
    if (mode === "register" && form.name.length < 2) {
      setError("Le nom doit contenir au moins 2 caractères.");
      setLoading(false);
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      setLoading(false);
      return;
    }

    try {
      const data = mode === "login" ? await api.login(form) : await api.register(form);
      setToken(data.token);
      navigate("/evaluations");
    } catch (err) {
      let errorMsg = err.message || String(err);
      try {
        const parsed = JSON.parse(errorMsg);
        errorMsg = parsed.message || errorMsg;
        if (parsed.message === "Email deja utilise") {
            errorMsg = "Cet email est déjà utilisé. Veuillez vous connecter.";
        }
      } catch (e) {
        // Not JSON
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-100 p-6 text-center">
            <div className="mx-auto bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-xl shadow-md mb-4">
                <i className="fa-solid fa-graduation-cap text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                ÉvaluPro
            </h1>
            <p className="text-sm text-gray-500 mt-1">
                {mode === "login" ? "Connectez-vous pour continuer" : "Créez votre compte enseignant"}
            </p>
        </div>

        {/* Form Body */}
        <div className="p-8">
            <form onSubmit={submit} className="space-y-5">
                
                {mode === "register" && (
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nom complet</label>
                    <input 
                        type="text" 
                        required 
                        minLength={2}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                        placeholder="Ex: Jean Tremblay" 
                        value={form.name} 
                        onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    />
                </div>
                )}
                
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Identifiant ou Email</label>
                    <input 
                        type="text" 
                        required 
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                        placeholder="vous@exemple.com" 
                        value={form.email} 
                        onChange={(e) => setForm({ ...form, email: e.target.value })} 
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mot de passe</label>
                    <input 
                        type="password" 
                        required 
                        minLength={8}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                        placeholder="••••••••" 
                        value={form.password} 
                        onChange={(e) => setForm({ ...form, password: e.target.value })} 
                    />
                    <p className="text-xs text-gray-400 mt-1 mt-2 text-right">Min. 8 caractères</p>
                </div>

                {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100 flex items-start gap-2">
                    <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                    <span>{error}</span>
                </div>
                )}

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? <div className="loader mr-2 border-white border-t-transparent"></div> : null}
                    {mode === "login" ? "Se connecter" : "S'inscrire"}
                </button>
            </form>
        </div>

        {/* Footer Toggle */}
        <div className="border-t border-gray-100 p-5 bg-gray-50 text-center">
            <button 
                type="button"
                className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                onClick={() => {
                    setMode(mode === "login" ? "register" : "login");
                    setError("");
                }}
            >
                {mode === "login" ? "Pas encore de compte ? S'inscrire" : "Déjà inscrit ? Se connecter"}
            </button>
        </div>

      </div>
    </div>
  );
}
