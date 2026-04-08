import { useState, useEffect } from "react";
import { api, getUserFromToken } from "../lib/api";
import { Link } from "react-router-dom";

export default function AdminUsers() {
  const user = getUserFromToken() || { _id: "" };
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const data = await api.getUsers();
      setUsers(data);
      setLoading(false);
    } catch (err) {
      setError(err.message || "Impossible de charger les utilisateurs.");
      setLoading(false);
    }
  }

  async function toggleRole(u) {
    if (u._id === user._id) {
      setError("Vous ne pouvez pas modifier votre propre rôle.");
      return;
    }
    try {
      const newRole = u.role === "admin" ? "teacher" : "admin";
      await api.updateUserRole(u._id, newRole);
      setSuccess(`Le rôle de ${u.name} a été modifié avec succès.`);
      setError("");
      fetchUsers();
    } catch (err) {
      setError(err.message || "Erreur de modification du rôle.");
    }
  }

  async function deleteUser(u) {
    if (u._id === user._id) {
      setError("Vous ne pouvez pas supprimer votre propre compte.");
      return;
    }
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le compte de ${u.name} ?`)) {
      return;
    }
    try {
      await api.deleteUser(u._id);
      setSuccess(`L'utilisateur ${u.name} a été supprimé.`);
      setError("");
      fetchUsers();
    } catch (err) {
      setError(err.message || "Erreur lors de la suppression.");
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement des utilisateurs...</div>;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <i className="fa-solid fa-users-cog mr-3 text-purple-600"></i>
        Gestion des Utilisateurs
      </h2>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm"><i className="fa-solid fa-circle-exclamation mr-2"></i>{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm"><i className="fa-solid fa-check-circle mr-2"></i>{success}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-semibold">Nom</th>
              <th className="px-6 py-4 font-semibold">Email (Identifiant)</th>
              <th className="px-6 py-4 font-semibold">Date d'inscription</th>
              <th className="px-6 py-4 font-semibold text-center">Rôle</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-800">{u.name} {u._id === user._id && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Vous</span>}</td>
                <td className="px-6 py-4 text-gray-500">{u.email}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.role === 'admin' ? 'Administrateur' : 'Professeur'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => toggleRole(u)} 
                    disabled={u._id === user._id}
                    title={u.role === 'admin' ? "Rétrograder en Professeur" : "Promouvoir Administrateur"}
                    className={`mr-3 p-2 rounded transition-colors ${u._id === user._id ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-blue-500 hover:bg-blue-50'}`}
                  >
                    <i className={`fa-solid ${u.role === 'admin' ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
                  </button>
                  <button 
                    onClick={() => deleteUser(u)} 
                    disabled={u._id === user._id}
                    title="Supprimer définitivement"
                    className={`p-2 rounded transition-colors ${u._id === user._id ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-red-500 hover:bg-red-50'}`}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <div className="p-8 text-center text-gray-500 italic">Aucun utilisateur trouvé.</div>}
      </div>
    </div>
  );
}
