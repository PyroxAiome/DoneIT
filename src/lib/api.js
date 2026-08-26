const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('km_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  let data = {};
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      data = { error: 'Failed to parse JSON response from server' };
    }
  } else {
    try {
      const text = await res.text();
      data = { error: text || `HTTP ${res.status}: ${res.statusText}` };
    } catch (e) {
      data = { error: `HTTP ${res.status}: ${res.statusText}` };
    }
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => request('/auth/me'),

  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'PUT', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }),

  getEmployees: (all = false) =>
    request(`/employees?all=${all}`),

  createUser: (data) =>
    request('/users', { method: 'POST', body: JSON.stringify(data) }),

  deleteUser: (id) =>
    request(`/users/${id}`, { method: 'DELETE' }),

  updateUser: (id, data) =>
    request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getTasks: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.assignee_id) qs.set('assignee_id', params.assignee_id);
    if (params.status) qs.set('status', params.status);
    if (params.category) qs.set('category', params.category);
    if (params.priority) qs.set('priority', params.priority);
    if (params.search) qs.set('search', params.search);
    if (params.date_range) qs.set('date_range', params.date_range);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
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

  getNotifications: () =>
    request('/notifications'),

  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, { method: 'PUT' }),

  markAllNotificationsRead: () =>
    request('/notifications/read-all', { method: 'POST' }),

  deleteNotification: (id) =>
    request(`/notifications/${id}`, { method: 'DELETE' }),

  clearNotifications: () =>
    request('/notifications', { method: 'DELETE' }),

  getDailyLogs: (taskId) =>
    request(`/tasks/${taskId}/daily-logs`),

  saveDailyLog: (taskId, log_date, content) =>
    request(`/tasks/${taskId}/daily-logs`, {
      method: 'POST',
      body: JSON.stringify({ log_date, content }),
    }),

  deleteDailyLog: (taskId, logId) =>
    request(`/tasks/${taskId}/daily-logs/${logId}`, { method: 'DELETE' }),

  reactToDailyLog: (taskId, logId, reaction_type) =>
    request(`/tasks/${taskId}/daily-logs/${logId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reaction_type }),
    }),

  addDailyLogComment: (taskId, logId, comment_text) =>
    request(`/tasks/${taskId}/daily-logs/${logId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment_text }),
    }),

  deleteDailyLogComment: (taskId, logId, commentId) =>
    request(`/tasks/${taskId}/daily-logs/${logId}/comments/${commentId}`, { method: 'DELETE' }),

  getExplanations: (taskId) =>
    request(`/tasks/${taskId}/explanations`),

  addExplanation: (taskId, explanation_text) =>
    request(`/tasks/${taskId}/explanations`, {
      method: 'POST',
      body: JSON.stringify({ explanation_text }),
    }),

  deleteExplanation: (taskId, expId) =>
    request(`/tasks/${taskId}/explanations/${expId}`, { method: 'DELETE' }),

  updateExplanation: (taskId, expId, explanation_text) =>
    request(`/tasks/${taskId}/explanations/${expId}`, {
      method: 'PUT',
      body: JSON.stringify({ explanation_text }),
    }),

  importBulkTasks: (tasks) =>
    request('/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({ tasks }),
    }),

  getPendingDependencies: () =>
    request('/dependencies/pending'),

  getDependencies: (taskId) =>
    request(`/tasks/${taskId}/dependencies`),

  createDependency: (taskId, tagee_id, dependency_text) =>
    request(`/tasks/${taskId}/dependencies`, {
      method: 'POST',
      body: JSON.stringify({ tagee_id, dependency_text }),
    }),

  replyDependency: (taskId, depId, reply_text) =>
    request(`/tasks/${taskId}/dependencies/${depId}/reply`, {
      method: 'PUT',
      body: JSON.stringify({ reply_text }),
    }),

  confirmDependency: (taskId, depId) =>
    request(`/tasks/${taskId}/dependencies/${depId}/confirm`, {
      method: 'PUT',
    }),

  // Projects
  getProjects: () =>
    request('/projects'),

  createProject: (data) =>
    request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProject: (id, data) =>
    request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteProject: (id) =>
    request(`/projects/${id}`, { method: 'DELETE' }),

  getProjectMembers: (id) =>
    request(`/projects/${id}/members`),

  addProjectMember: (id, payload) =>
    request(`/projects/${id}/members`, {
      method: 'POST',
      body: JSON.stringify(typeof payload === 'object' ? payload : { user_id: payload }),
    }),

  updateProjectMemberPermissions: (id, userId, permissions) =>
    request(`/projects/${id}/members/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify(permissions),
    }),

  removeProjectMember: (id, userId) =>
    request(`/projects/${id}/members/${userId}`, { method: 'DELETE' }),

  getProjectTasks: (id, params = {}) => {
    const qs = new URLSearchParams();
    qs.set('project_id', id);
    if (params.assignee_id) qs.set('assignee_id', params.assignee_id);
    if (params.status) qs.set('status', params.status);
    if (params.category) qs.set('category', params.category);
    if (params.priority) qs.set('priority', params.priority);
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return request(`/tasks${q ? '?' + q : ''}`);
  },

  getTaskQuota: () => request('/tasks/quota'),

  // Site Inventory APIs
  getInventoryMaster: () => request('/inventory/master'),

  addInventoryMaster: (data) =>
    request('/inventory/master', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteInventoryMaster: (id) =>
    request(`/inventory/master/${id}`, {
      method: 'DELETE',
    }),
  getProjectInventory: (id) => request(`/projects/${id}/inventory`),

  logInwardMaterial: (id, data) =>
    request(`/projects/${id}/inventory/inward`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logMaterialUsage: (id, data) =>
    request(`/projects/${id}/inventory/usage`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logMaterialScrap: (id, data) =>
    request(`/projects/${id}/inventory/scrap`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  verifyDeliveryChallan: (projectId, receiptId, action, rejection_reason = '') =>
    request(`/projects/${projectId}/inventory/receipts/${receiptId}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ action, rejection_reason }),
    }),

  resubmitMaterialReceipt: (projectId, receiptId, data) =>
    request(`/projects/${projectId}/inventory/receipts/${receiptId}/resubmit`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  logPhysicalAudit: (projectId, data) =>
    request(`/projects/${projectId}/inventory/physical-audit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Document Vault APIs
  getProjectDocuments: (id) => request(`/projects/${id}/documents`),

  uploadProjectDocument: async (projectId, formData) => {
    const token = getToken();
    const res = await fetch(`/api/projects/${projectId}/documents/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  verifyProjectDocument: (projectId, docId, action, rejection_reason = '') =>
    request(`/projects/${projectId}/documents/${docId}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ action, rejection_reason }),
    }),

  deleteProjectDocument: (projectId, docId) =>
    request(`/projects/${projectId}/documents/${docId}`, { method: 'DELETE' }),
};
