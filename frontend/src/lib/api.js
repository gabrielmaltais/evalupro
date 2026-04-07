const API_URL = typeof import.meta.env.VITE_API_URL !== 'undefined' ? import.meta.env.VITE_API_URL : "http://localhost:4000";

export function setToken(token) {
  localStorage.setItem("token", token);
}

export function getToken() {
  return localStorage.getItem("token");
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
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Erreur API");
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  register: (payload) => request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/api/auth/me"),
  listRubrics: () => request("/api/rubrics"),
  createRubric: (payload) => request("/api/rubrics", { method: "POST", body: JSON.stringify(payload) }),
  updateRubric: (id, payload) => request(`/api/rubrics/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteRubric: (id) => request(`/api/rubrics/${id}`, { method: "DELETE" }),
  listEvaluations: () => request("/api/evaluations"),
  listEvaluationsByStudent: (studentId) => request(`/api/evaluations?studentId=${studentId}&limit=50`),
  getEvaluation: (id) => request(`/api/evaluations/${id}`),
  createEvaluation: (payload) => request("/api/evaluations", { method: "POST", body: JSON.stringify(payload) }),
  updateEvaluation: (id, payload) => request(`/api/evaluations/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteEvaluation: (id) => request(`/api/evaluations/${id}`, { method: "DELETE" }),
  listStudents: () => request("/api/students"),
  createStudent: (payload) => request("/api/students", { method: "POST", body: JSON.stringify(payload) }),
  createStudentsBulk: (payload) => request("/api/students/bulk", { method: "POST", body: JSON.stringify(payload) }),
  updateStudent: (id, payload) => request(`/api/students/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteStudent: (id) => request(`/api/students/${id}`, { method: "DELETE" }),
};
