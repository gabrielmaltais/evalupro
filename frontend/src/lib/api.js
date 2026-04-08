const API_URL = typeof import.meta.env.VITE_API_URL !== 'undefined' && import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : "";

export function setToken(token) {
  localStorage.setItem("token", token);
}

export function getToken() {
  return localStorage.getItem("token") || localStorage.getItem("eval_token"); // Compatibility logic if needed
}

export function getUserFromToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      ...payload,
      _id: payload.sub,
      id: payload.sub,
    };
  } catch (e) {
    return null;
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  // Token invalide ou expiré → déconnexion automatique
  if (response.status === 401 && path !== "/api/auth/login") {
    localStorage.removeItem("token");
    localStorage.removeItem("eval_token");
    window.location.href = "/login";
    return;
  }

  if (!response.ok) {
    let errorMsg = "Erreur API";
    try {
      const data = await response.clone().json();
      errorMsg = data.message || errorMsg;
      if (data.details) {
        errorMsg = `${errorMsg} (${data.details})`;
      }
    } catch {
      errorMsg = await response.text() || errorMsg;
    }
    throw new Error(errorMsg);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  register: (payload) => request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/api/auth/me"),
  updateMe: (payload) => request("/api/auth/me", { method: "PUT", body: JSON.stringify(payload) }),
  listRubrics: () => request("/api/rubrics"),
  createRubric: (payload) => request("/api/rubrics", { method: "POST", body: JSON.stringify(payload) }),
  updateRubric: (id, payload) => request(`/api/rubrics/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteRubric: (id) => request(`/api/rubrics/${id}`, { method: "DELETE" }),
  listEvaluations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/evaluations${qs ? `?${qs}` : ""}`);
  },
  listEvaluationsByStudent: (studentId) => request(`/api/evaluations?studentId=${studentId}&limit=50`),
  getEvaluation: (id) => request(`/api/evaluations/${id}`),
  createEvaluation: (payload) => request("/api/evaluations", { method: "POST", body: JSON.stringify(payload) }),
  updateEvaluation: (id, payload) => request(`/api/evaluations/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteEvaluation: (id) => request(`/api/evaluations/${id}`, { method: "DELETE" }),
  listStudents: () => request("/api/students"),
  createStudent: (payload) => request("/api/students", { method: "POST", body: JSON.stringify(payload) }),
  createStudentsBulk: (payload) => request("/api/students/bulk", { method: "POST", body: JSON.stringify(payload) }),
  getStudentGroupDashboard: () => request("/api/students/group-dashboard"),
  renameGroup: (from, to) => request("/api/students/groups/rename", { method: "POST", body: JSON.stringify({ from, to }) }),
  mergeGroups: (fromGroups, to) => request("/api/students/groups/merge", { method: "POST", body: JSON.stringify({ fromGroups, to }) }),
  clearGroup: (groupName) => request(`/api/students/groups/${encodeURIComponent(groupName)}`, { method: "DELETE" }),
  updateStudent: (id, payload) => request(`/api/students/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteStudent: (id) => request(`/api/students/${id}`, { method: "DELETE" }),
  
  getUsers: () => request("/api/users"),
  updateUserRole: (id, role) => request(`/api/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: "DELETE" }),

  getSmtpConfig: () => request("/api/admin/smtp-config"),
  updateSmtpConfig: (payload) => request("/api/admin/smtp-config", { method: "PUT", body: JSON.stringify(payload) }),
  testSmtpConfig: (override) => request("/api/admin/smtp-config/test", { method: "POST", body: JSON.stringify(override ? { override } : {}) }),

  getEmailTargets: () => request("/api/evaluations/email-targets"),
  startEmailBatch: (payload) => request("/api/evaluations/email-batches", { method: "POST", body: JSON.stringify(payload) }),
  getEmailBatchProgress: (jobId) => request(`/api/evaluations/email-batches/${jobId}`),
  listEmailDeliveries: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/evaluations/email-deliveries${qs ? `?${qs}` : ""}`);
  },
  retryFailedEmailBatch: (jobId, payload = {}) => request(`/api/evaluations/email-batches/${jobId}/retry-failed`, { method: "POST", body: JSON.stringify(payload) }),
};
