import { useEffect, useState } from "react";
import { api, getUserFromToken, setToken } from "../lib/api";
import PageHeader from "../components/PageHeader";
import TopPageMenu from "../components/TopPageMenu";

export default function AccountSettings() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (cancelled || !user) return;
        setName(user.name || "");
        setEmail(user.email || "");
      } catch {
        const t = getUserFromToken();
        if (!cancelled && t) {
          setName(t.name || "");
          setEmail(t.email || "");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("La confirmation du mot de passe ne correspond pas.");
        return;
      }
    }
    if (!currentPassword.trim()) {
      setError("Indiquez votre mot de passe actuel pour enregistrer les changements.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateMe({
        name: name.trim(),
        email: email.trim(),
        currentPassword,
        newPassword: newPassword.trim() || undefined,
      });
      if (res?.token) setToken(res.token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Profil mis à jour.");
      if (res?.user) {
        setName(res.user.name || "");
        setEmail(res.user.email || "");
      }
    } catch (err) {
      setError(err.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-100 dm-bg min-h-screen flex items-center justify-center text-gray-500">
        Chargement du profil…
      </div>
    );
  }

  return (
    <div className="bg-gray-100 dm-bg min-h-screen text-gray-800 dm-text-primary font-sans flex flex-col">
      <PageHeader
        icon="fa-user-gear"
        iconBgClass="bg-slate-600"
        title="Mon compte"
        subtitle="Nom, email et mot de passe"
      />
      <TopPageMenu />
      <main className="flex-grow max-w-lg mx-auto w-full py-8 px-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-100">
            <i className="fa-solid fa-circle-exclamation mr-2" />
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm border border-green-100">
            <i className="fa-solid fa-check-circle mr-2" />
            {success}
          </div>
        )}
        <form onSubmit={handleSubmit} className="bg-white dm-surface rounded-xl shadow-sm border border-gray-100 dm-border p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Pour des raisons de sécurité, votre <strong>mot de passe actuel</strong> est demandé à chaque enregistrement.
          </p>
          <label className="text-sm block">
            Nom affiché
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              required
            />
          </label>
          <label className="text-sm block">
            Email (identifiant de connexion)
            <input
              type="email"
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase">Nouveau mot de passe</p>
            <label className="text-sm block">
              Laisser vide pour ne pas changer
              <input
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
            <label className="text-sm block">
              Confirmer le nouveau mot de passe
              <input
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          </div>
          <label className="text-sm block">
            <span className="text-red-600">*</span> Mot de passe actuel
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 rounded-lg disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>
      </main>
    </div>
  );
}
