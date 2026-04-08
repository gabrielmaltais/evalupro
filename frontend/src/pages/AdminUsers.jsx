import { useState, useEffect } from "react";
import { api, getUserFromToken } from "../lib/api";
import PageHeader from "../components/PageHeader";
import TopPageMenu from "../components/TopPageMenu";

const DEFAULT_SMTP_EMAIL_SUBJECT = "Copie d'évaluation — {examTitle}";
const DEFAULT_SMTP_EMAIL_BODY = `Bonjour {studentName},

Veuillez trouver ci-joint votre copie d'évaluation pour « {examTitle} » ({courseTitle}).

Cordialement,
{teacherName}`;

export default function AdminUsers() {
  const user = getUserFromToken() || { _id: "" };
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);

  const [smtpForm, setSmtpForm] = useState({
    host: "",
    port: 587,
    secure: false,
    user: "",
    password: "",
    fromName: "EvaluPro",
    fromEmail: "",
    emailSubjectTemplate: DEFAULT_SMTP_EMAIL_SUBJECT,
    emailBodyTemplate: DEFAULT_SMTP_EMAIL_BODY,
    isActive: true,
  });
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingSmtp, setLoadingSmtp] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchUsers() {
    try {
      const data = await api.getUsers();
      setUsers(data);
      setLoadingUsers(false);
    } catch (err) {
      setError(err.message || "Impossible de charger les utilisateurs.");
      setLoadingUsers(false);
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

  async function saveSmtpConfig() {
    setError("");
    setSuccess("");
    try {
      await api.updateSmtpConfig({
        host: smtpForm.host,
        port: Number(smtpForm.port),
        secure: !!smtpForm.secure,
        user: smtpForm.user,
        password: smtpForm.password || undefined,
        fromName: smtpForm.fromName,
        fromEmail: smtpForm.fromEmail,
        emailSubjectTemplate: smtpForm.emailSubjectTemplate,
        emailBodyTemplate: smtpForm.emailBodyTemplate,
        isActive: !!smtpForm.isActive,
      });
      setSmtpForm((prev) => ({ ...prev, password: "" }));
      setSuccess("Configuration SMTP enregistrée.");
    } catch (err) {
      setError(err.message || "Erreur d'enregistrement SMTP.");
    }
  }

  async function testSmtpConfig() {
    setError("");
    setSuccess("");
    try {
      await api.testSmtpConfig({
        host: smtpForm.host,
        port: Number(smtpForm.port),
        secure: !!smtpForm.secure,
        user: smtpForm.user,
        password: smtpForm.password,
        fromName: smtpForm.fromName,
        fromEmail: smtpForm.fromEmail,
        isActive: !!smtpForm.isActive,
      });
      setSuccess("Connexion SMTP valide.");
    } catch (err) {
      setError(err.message || "Test SMTP échoué.");
    }
  }

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const [usersData, smtpData] = await Promise.all([
          api.getUsers(),
          api.getSmtpConfig(),
        ]);

        if (!isMounted) return;

        setUsers(usersData);
        if (smtpData?.config) {
          setSmtpForm((prev) => ({
            ...prev,
            ...smtpData.config,
            password: "",
            emailSubjectTemplate: smtpData.config.emailSubjectTemplate || DEFAULT_SMTP_EMAIL_SUBJECT,
            emailBodyTemplate: smtpData.config.emailBodyTemplate || DEFAULT_SMTP_EMAIL_BODY,
          }));
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Impossible de charger la page d'administration.");
        }
      } finally {
        if (isMounted) {
          setLoadingUsers(false);
          setLoadingSmtp(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loadingUsers && loadingSmtp) return <div className="p-8 text-center text-gray-500">Chargement administration...</div>;

  return (
    <div className="bg-gray-100 dm-bg min-h-screen text-gray-800 dm-text-primary font-sans flex flex-col">
      <PageHeader
        icon="fa-screwdriver-wrench"
        iconBgClass="bg-indigo-600"
        title="Administration"
        subtitle="Utilisateurs et SMTP"
      />
      <TopPageMenu />
      <main className="flex-grow max-w-5xl mx-auto w-full py-8 px-4">

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm"><i className="fa-solid fa-circle-exclamation mr-2"></i>{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm"><i className="fa-solid fa-check-circle mr-2"></i>{success}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setActiveTab("users")} className={`px-3 py-2 rounded-lg text-sm border ${activeTab === "users" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}>
            Utilisateurs
          </button>
          <button onClick={() => setActiveTab("smtp")} className={`px-3 py-2 rounded-lg text-sm border ${activeTab === "smtp" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}>
            SMTP
          </button>
        </div>
      </div>

      {activeTab === "users" && (
        <div className="bg-white dm-surface rounded-xl shadow-sm border border-gray-100 dm-border overflow-hidden">
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
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${u.role === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                      {u.role === "admin" ? "Administrateur" : "Professeur"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => toggleRole(u)}
                      disabled={u._id === user._id}
                      title={u.role === "admin" ? "Rétrograder en Professeur" : "Promouvoir Administrateur"}
                      className={`mr-3 p-2 rounded transition-colors ${u._id === user._id ? "opacity-50 cursor-not-allowed text-gray-400" : "text-blue-500 hover:bg-blue-50"}`}
                    >
                      <i className={`fa-solid ${u.role === "admin" ? "fa-arrow-down" : "fa-arrow-up"}`}></i>
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      disabled={u._id === user._id}
                      title="Supprimer définitivement"
                      className={`p-2 rounded transition-colors ${u._id === user._id ? "opacity-50 cursor-not-allowed text-gray-400" : "text-red-500 hover:bg-red-50"}`}
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
      )}

      {activeTab === "smtp" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm">Host
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={smtpForm.host} onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })} />
            </label>
            <label className="text-sm">Port
              <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2" value={smtpForm.port} onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })} />
            </label>
            <label className="text-sm">Utilisateur SMTP
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={smtpForm.user} onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })} />
            </label>
            <label className="text-sm">Mot de passe SMTP
              <input type="password" className="mt-1 w-full border rounded-lg px-3 py-2" value={smtpForm.password} onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })} placeholder="Laisser vide pour conserver l'existant" />
            </label>
            <label className="text-sm">Nom expéditeur (tests / secours)
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={smtpForm.fromName} onChange={(e) => setSmtpForm({ ...smtpForm, fromName: e.target.value })} />
            </label>
            <label className="text-sm">Email expéditeur
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={smtpForm.fromEmail} onChange={(e) => setSmtpForm({ ...smtpForm, fromEmail: e.target.value })} />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Les envois de copies d&apos;évaluation affichent comme expéditeur le <strong>nom complet du professeur</strong> qui lance l&apos;envoi (adresse ci-dessus).
          </p>
          <div className="space-y-2">
            <label className="text-sm block">Objet du mail (envoi PDF)
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={smtpForm.emailSubjectTemplate} onChange={(e) => setSmtpForm({ ...smtpForm, emailSubjectTemplate: e.target.value })} />
            </label>
            <label className="text-sm block">Corps du message (texte brut)
              <textarea rows={10} className="mt-1 w-full border rounded-lg px-3 py-2 font-mono text-sm" value={smtpForm.emailBodyTemplate} onChange={(e) => setSmtpForm({ ...smtpForm, emailBodyTemplate: e.target.value })} />
            </label>
            <p className="text-xs text-gray-500">
              Variables : <code className="bg-gray-100 px-1 rounded">{"{studentName}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{examTitle}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{courseTitle}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{teacherName}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{group}"}</code>.
            </p>
          </div>
          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={smtpForm.secure} onChange={(e) => setSmtpForm({ ...smtpForm, secure: e.target.checked })} />Connexion sécurisée (SSL/TLS)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={smtpForm.isActive} onChange={(e) => setSmtpForm({ ...smtpForm, isActive: e.target.checked })} />Configuration active</label>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={testSmtpConfig} className="px-4 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50">Tester la connexion</button>
            <button type="button" onClick={saveSmtpConfig} className="px-5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Enregistrer</button>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
