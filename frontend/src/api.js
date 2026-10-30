const API_BASE = '/api';

export const getAuthToken = () => localStorage.getItem('aicte_token');
export const setAuthToken = (token) => localStorage.setItem('aicte_token', token);
export const removeAuthToken = () => localStorage.removeItem('aicte_token');

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('aicte_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};
export const setStoredUser = (user) => localStorage.setItem('aicte_user', JSON.stringify(user));
export const removeStoredUser = () => localStorage.removeItem('aicte_user');

export async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = { ...options.headers };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is not FormData, set Content-Type to application/json
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP error ${response.status}`);
  }
  return data;
}

// Authentication APIs
export const authApi = {
  login: (username, password) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  verifyMfa: (mfaSessionToken, code) => apiRequest('/auth/verify-mfa', {
    method: 'POST',
    body: JSON.stringify({ mfaSessionToken, code })
  }),
  register: (payload) => apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  quickSwitch: (role, username) => apiRequest('/auth/quick-switch', {
    method: 'POST',
    body: JSON.stringify({ role, username })
  }),
  getMe: () => apiRequest('/auth/me'),
  getLoginHistory: () => apiRequest('/auth/login-history'),
  toggleMfa: () => apiRequest('/auth/toggle-mfa', { method: 'POST' })
};

// Document APIs
export const documentApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/documents${query ? `?${query}` : ''}`);
  },
  getById: (id) => apiRequest(`/documents/${id}`),
  upload: (formData) => apiRequest('/documents/upload', {
    method: 'POST',
    body: formData
  }),
  getSignedToken: (id, expiresInSeconds = 300) => apiRequest(`/documents/${id}/signed-token`, {
    method: 'POST',
    body: JSON.stringify({ expiresInSeconds })
  }),
  replaceVersion: (id, formData) => apiRequest(`/documents/${id}/replace`, {
    method: 'POST',
    body: formData
  }),
  verify: (id, status, remarks) => apiRequest(`/documents/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ status, remarks })
  }),
  updateVisibility: (id, payload) => apiRequest(`/documents/${id}/visibility`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  getVersions: (id) => apiRequest(`/documents/${id}/versions`),
  delete: (id) => apiRequest(`/documents/${id}`, { method: 'DELETE' })
};

// Application APIs
export const applicationApi = {
  list: () => apiRequest('/applications'),
  getById: (id) => apiRequest(`/applications/${id}`),
  assign: (id, payload) => apiRequest(`/applications/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  decide: (id, decision, remarks) => apiRequest(`/applications/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, remarks })
  })
};

// Comments APIs
export const commentApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/comments${query ? `?${query}` : ''}`);
  },
  create: (payload) => apiRequest('/comments', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  release: (id) => apiRequest(`/comments/${id}/release`, {
    method: 'POST'
  })
};

// Admin & RBAC APIs
export const adminApi = {
  getRolesPermissions: () => apiRequest('/admin/roles-permissions'),
  updateRolePermission: (role, permission, isAllowed) => apiRequest('/admin/roles-permissions', {
    method: 'PUT',
    body: JSON.stringify({ role, permission, isAllowed })
  }),
  getUserOverrides: (userId) => apiRequest(`/admin/user-overrides/${userId}`),
  setUserOverride: (payload) => apiRequest('/admin/user-overrides', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getUsers: () => apiRequest('/admin/users'),
  updateUserStatus: (id, isActive) => apiRequest(`/admin/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ isActive })
  }),
  getVisibilityClassifications: () => apiRequest('/admin/visibility-classifications'),
  updateVisibilityClassification: (code, payload) => apiRequest(`/admin/visibility-classifications/${code}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
};

// Audit APIs
export const auditApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/audit/all${query ? `?${query}` : ''}`);
  },
  getByDocument: (docId) => apiRequest(`/audit/documents/${docId}`),
  verifyIntegrity: () => apiRequest('/audit/verify-integrity')
};

// Security Tests APIs
export const securityApi = {
  runTests: () => apiRequest('/security-tests/run', { method: 'POST' })
};
