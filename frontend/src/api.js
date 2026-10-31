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

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return await response.text();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = (data.error && typeof data.error === 'object' ? data.error.message : data.error) 
      || data.message 
      || `HTTP error ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.code = (data.error && data.error.code) || 'API_ERROR';
    err.response = data;
    throw err;
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

// Workflow APIs
export const workflowApi = {
  getTemplates: () => apiRequest('/workflows/templates'),
  getHistory: (applicationId) => apiRequest(`/workflows/applications/${applicationId}/history`),
  transition: (applicationId, nextStage, remarks) => apiRequest(`/workflows/applications/${applicationId}/transition`, {
    method: 'POST',
    body: JSON.stringify({ nextStage, remarks })
  }),
  hold: (applicationId, reason) => apiRequest(`/workflows/applications/${applicationId}/hold`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),
  resume: (applicationId, remarks) => apiRequest(`/workflows/applications/${applicationId}/resume`, {
    method: 'POST',
    body: JSON.stringify({ remarks })
  })
};

// Scrutiny & Deficiency APIs
export const scrutinyApi = {
  getEvaluation: (applicationId) => apiRequest(`/scrutiny/evaluations/${applicationId}`),
  saveItem: (applicationId, itemData) => apiRequest(`/scrutiny/evaluations/${applicationId}/item`, {
    method: 'POST',
    body: JSON.stringify(itemData)
  }),
  completeEvaluation: (applicationId, overall_recommendation, remarks) => apiRequest(`/scrutiny/evaluations/${applicationId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ overall_recommendation, remarks })
  }),
  getDeficiencies: (applicationId) => apiRequest(`/scrutiny/deficiencies/${applicationId}`),
  createDeficiency: (payload) => apiRequest('/scrutiny/deficiencies', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  respondDeficiency: (id, institutionResponse, documentId) => apiRequest(`/scrutiny/deficiencies/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ institutionResponse, documentId })
  }),
  resolveDeficiency: (id, status, resolutionRemarks) => apiRequest(`/scrutiny/deficiencies/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ status, resolutionRemarks })
  })
};

// EVC APIs
export const evcApi = {
  listInspections: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/evc/inspections${query ? `?${query}` : ''}`);
  },
  getByApplication: (applicationId) => apiRequest(`/evc/inspections/${applicationId}`),
  schedule: (payload) => apiRequest('/evc/inspections/schedule', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  submitFindings: (id, payload) => apiRequest(`/evc/inspections/${id}/submit-findings`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  uploadEvidence: (id, formData) => apiRequest(`/evc/inspections/${id}/evidence`, {
    method: 'POST',
    body: formData
  })
};

// SAC Hearings APIs
export const sacApi = {
  listHearings: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/sac/hearings${query ? `?${query}` : ''}`);
  },
  getByApplication: (applicationId) => apiRequest(`/sac/hearings/${applicationId}`),
  schedule: (payload) => apiRequest('/sac/hearings/schedule', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  recordRecommendation: (id, payload) => apiRequest(`/sac/hearings/${id}/recommendation`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};

// Competent Authority Decisions APIs
export const decisionApi = {
  listPending: () => apiRequest('/decisions/pending'),
  getByApplication: (applicationId) => apiRequest(`/decisions/application/${applicationId}`),
  renderDecision: (payload) => apiRequest('/decisions/render', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};

// Undertakings APIs
export const undertakingApi = {
  getTemplates: () => apiRequest('/undertakings/templates'),
  getSubmissions: (applicationId) => apiRequest(`/undertakings/submissions/${applicationId}`),
  submit: (payload) => apiRequest('/undertakings/submit', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  verify: (id, status, verificationRemarks) => apiRequest(`/undertakings/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ status, verificationRemarks })
  })
};

// Compliance APIs
export const complianceApi = {
  getObligations: (institutionId) => apiRequest(`/compliance/obligations/${institutionId}`),
  getScorecard: (institutionId) => apiRequest(`/compliance/scorecard/${institutionId}`),
  submitEvidence: (id, documentId, evidenceNotes) => apiRequest(`/compliance/obligations/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ documentId, evidenceNotes })
  }),
  reviewEvidence: (id, status, reviewNotes) => apiRequest(`/compliance/obligations/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, reviewNotes })
  })
};

// Notifications APIs
export const notificationApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/notifications${query ? `?${query}` : ''}`);
  },
  markRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => apiRequest('/notifications/read-all', { method: 'POST' })
};

// Escalations APIs
export const escalationApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/escalations${query ? `?${query}` : ''}`);
  },
  scan: () => apiRequest('/escalations/scan', { method: 'POST' }),
  resolve: (id, resolutionNotes) => apiRequest(`/escalations/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolutionNotes })
  })
};

// Institution Profile APIs
export const institutionApi = {
  getById: (id) => apiRequest(`/institutions/${id}`),
  update: (id, payload) => apiRequest(`/institutions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  searchByPid: (aicteId) => apiRequest(`/institutions/search/pid/${aicteId}`)
};

// Reports APIs
export const reportApi = {
  getSummary: () => apiRequest('/reports/summary'),
  getOfficerWorkload: () => apiRequest('/reports/officer-workload'),
  exportApplications: (format = 'csv') => apiRequest(`/reports/export/applications?format=${format}`),
  exportCompliance: (format = 'csv') => apiRequest(`/reports/export/compliance?format=${format}`)
};

// AI Advisory APIs
export const aiApi = {
  analyzeApplication: (applicationId) => apiRequest(`/ai/analyze-application/${applicationId}`),
  classifyDocument: (payload) => apiRequest('/ai/classify-document', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getSlaRisks: () => apiRequest('/ai/statutory-sla-risk')
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

// =========================================================================
// AICTE SECURITY DEPOSIT & FDR PORTAL (PS-26265) CLIENT APIS
// =========================================================================

export const fdrApi = {
  getStats: () => apiRequest('/fdr/stats'),
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/fdr${query ? `?${query}` : ''}`);
  },
  getById: (id) => apiRequest(`/fdr/${id}`),
  create: (payload) => apiRequest('/fdr', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  update: (id, payload) => apiRequest(`/fdr/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  submit: (id) => apiRequest(`/fdr/${id}/submit`, {
    method: 'POST'
  }),
  getHistory: (id) => apiRequest(`/fdr/${id}/history`),
  uploadDocument: (id, formData) => apiRequest(`/fdr/${id}/documents`, {
    method: 'POST',
    body: formData
  }),
  getDocumentToken: (docId) => apiRequest(`/fdr/documents/${docId}/token`, {
    method: 'POST'
  }),
  deleteDocument: (docId) => apiRequest(`/fdr/documents/${docId}`, {
    method: 'DELETE'
  })
};

export const fdrVerificationApi = {
  getPending: () => apiRequest('/fdr-verification/pending'),
  verify: (id, payload) => apiRequest(`/fdr-verification/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  raiseDiscrepancy: (id, payload) => apiRequest(`/fdr-verification/${id}/discrepancy`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  respondDiscrepancy: (discrepancyId, payload) => apiRequest(`/fdr-verification/discrepancy/${discrepancyId}/respond`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  resolveDiscrepancy: (discrepancyId, payload) => apiRequest(`/fdr-verification/discrepancy/${discrepancyId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};

export const fdrRenewalApi = {
  getDue: () => apiRequest('/fdr-renewals/due'),
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/fdr-renewals${query ? `?${query}` : ''}`);
  },
  submit: (fdrId, payload) => apiRequest(`/fdr-renewals/${fdrId}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  review: (renewalId, payload) => apiRequest(`/fdr-renewals/${renewalId}/review`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};

export const fdrReleaseApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/fdr-releases${query ? `?${query}` : ''}`);
  },
  request: (fdrId, payload) => apiRequest(`/fdr-releases/${fdrId}/request`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  scrutiny: (requestId, payload) => apiRequest(`/fdr-releases/${requestId}/scrutiny`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  decision: (requestId, payload) => apiRequest(`/fdr-releases/${requestId}/decision`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  complete: (requestId, payload) => apiRequest(`/fdr-releases/${requestId}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};

export const fdrReportApi = {
  getRegister: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/fdr-reports/register${query ? `?${query}` : ''}`);
  },
  getMaturityCalendar: () => apiRequest('/fdr-reports/maturity-calendar'),
  getBankDistribution: () => apiRequest('/fdr-reports/bank-distribution'),
  getComplianceSummary: () => apiRequest('/fdr-reports/compliance-summary'),
  downloadCsv: () => {
    const token = getAuthToken();
    window.open(`/api/fdr-reports/register?format=csv&token=${encodeURIComponent(token || '')}`, '_blank');
  }
};

