import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageSectionTitle from "../components/PageSectionTitle";

const DEFAULT_FORM = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  password: "",
  fromName: "EvaluPro",
  fromEmail: "",
  emailSubjectTemplate: "Copie d'évaluation — {examTitle}",
  emailBodyTemplate: `Bonjour {studentFirstName},

Veuillez trouver ci-joint votre copie d'évaluation pour « {examTitle} » ({courseTitle}).

Cordialement,
{teacherName}`,
  isActive: true,
};

const TEMPLATE_VARIABLES = [
  "{studentFirstName}",
  "{studentLastName}",
  "{studentName}",
  "{examTitle}",
  "{courseTitle}",
  "{teacherName}",
  "{group}",
];

export default function AdminSmtp() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSmtpConfig()
      .then((res) => {
        if (res?.config) {
          setForm((f) => ({
            ...f,
            ...res.config,
            password: "",
            emailSubjectTemplate: res.config.emailSubjectTemplate || DEFAULT_FORM.emailSubjectTemplate,
            emailBodyTemplate: res.config.emailBodyTemplate || DEFAULT_FORM.emailBodyTemplate,
          }));
        }
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, []);

  async function saveConfig() {
    setError("");
    setSuccess("");
    try {
      await api.updateSmtpConfig({
        host: form.host,
        port: Number(form.port),
        secure: !!form.secure,
        user: form.user,
        password: form.password || undefined,
        fromName: form.fromName,
        fromEmail: form.fromEmail,
        emailSubjectTemplate: form.emailSubjectTemplate,
        emailBodyTemplate: form.emailBodyTemplate,
        isActive: !!form.isActive,
      });
      setForm((f) => ({ ...f, password: "" }));
      setSuccess("Configuration SMTP enregistrée.");
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function testConfig() {
    setError("");
    setSuccess("");
    try {
      await api.testSmtpConfig({
        host: form.host,
        port: Number(form.port),
        secure: !!form.secure,
        user: form.user,
        password: form.password,
        fromName: form.fromName,
        fromEmail: form.fromEmail,
        isActive: !!form.isActive,
      });
      setSuccess("Connexion SMTP valide.");
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement SMTP...</div>;

  return (
    <div className="flex w-full flex-1 flex-col text-gray-800">
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">
        <PageSectionTitle
          icon="fa-envelope"
          iconBgClass="bg-emerald-600"
          title="Configuration SMTP"
          subtitle="Serveur d'envoi des copies"
        />
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">{success}</div>}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm">Host
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
            </label>
            <label className="text-sm">Port
              <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
            </label>
            <label className="text-sm">Utilisateur SMTP
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
            </label>
            <label className="text-sm">Mot de passe SMTP
              <input type="password" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Laisser vide pour conserver l'existant" />
            </label>
            <label className="text-sm">Nom expéditeur (tests / secours)
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} />
            </label>
            <label className="text-sm">Email expéditeur
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Les envois de copies affichent le <strong>nom du professeur</strong> comme expéditeur (adresse ci-dessus).
          </p>
          <label className="text-sm block">Objet du mail (envoi PDF)
            <input className="mt-1 w-full border rounded-lg px-3 py-2" value={form.emailSubjectTemplate} onChange={(e) => setForm({ ...form, emailSubjectTemplate: e.target.value })} />
          </label>
          <label className="text-sm block">Corps du message
            <textarea rows={8} className="mt-1 w-full border rounded-lg px-3 py-2 font-mono text-sm" value={form.emailBodyTemplate} onChange={(e) => setForm({ ...form, emailBodyTemplate: e.target.value })} />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-800">Variables disponibles pour les templates</div>
            <p className="mt-1 text-xs text-slate-600">
              Utilise ces variables dans l&apos;objet et le corps, par exemple: <span className="font-mono">Bonjour {"{studentFirstName}"}</span>.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TEMPLATE_VARIABLES.map((variable) => (
                <code key={variable} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
                  {variable}
                </code>
              ))}
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.secure} onChange={(e) => setForm({ ...form, secure: e.target.checked })} />Connexion sécurisée (SSL/TLS)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Configuration active</label>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={testConfig} className="px-4 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50">Tester la connexion</button>
            <button type="button" onClick={saveConfig} className="px-5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Enregistrer</button>
          </div>
        </div>
      </main>
    </div>
  );
}
