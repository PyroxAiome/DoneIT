const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('km_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => request('/auth/me'),

  getEmployees: (all = false) =>
    request(`/employees?all=${all}`),

  createUser: (data) =>
    request('/users', { method: 'POST', body: JSON.stringify(data) }),

  deleteUser: (id) =>
    request(`/users/${id}`, { method: 'DELETE' }),

  getTasks: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.assignee_id) qs.set('assignee_id', params.assignee_id);
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return request(`/tasks${q ? '?' + q : ''}`);
  },

  getTask: (id) =>
    request(`/tasks/${id}`),

  createTask: (data) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),

  updateTask: (id, data) =>
    request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteTask: (id) =>
    request(`/tasks/${id}`, { method: 'DELETE' }),

  addComment: (taskId, text, parentId) =>
    request(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ comment_text: text, parent_id: parentId }) }),

  editComment: (taskId, commentId, text) =>
    request(`/tasks/${taskId}/comments/${commentId}`, { method: 'PUT', body: JSON.stringify({ comment_text: text }) }),

  deleteComment: (taskId, commentId) =>
    request(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' }),

  getComments: (taskId) =>
    request(`/tasks/${taskId}/comments`),

  getDashboardStats: () =>
    request('/dashboard/stats'),
};
