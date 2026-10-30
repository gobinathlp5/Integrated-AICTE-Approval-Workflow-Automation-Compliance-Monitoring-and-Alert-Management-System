const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { verifyAuditChainIntegrity } = require('../audit');
const { authenticateToken } = require('../auth');

/**
 * GET /api/audit/all
 * System-wide document audit history
 */
router.get('/all', authenticateToken, (req, res) => {
  const { action, institutionId, limit = 100 } = req.query;

  let query = `
    SELECT a.*, d.title as document_title, d.file_name, d.document_number,
           i.name as institution_name
    FROM document_audit_trail a
    LEFT JOIN documents d ON a.document_id = d.id
    LEFT JOIN institutions i ON a.institution_id = i.id
    WHERE 1=1
  `;
  const params = [];

  // Institution tenant isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ` AND a.institution_id = ?`;
    params.push(req.user.institution_id);
  } else if (institutionId) {
    query += ` AND a.institution_id = ?`;
    params.push(institutionId);
  }

  if (action && action !== 'ALL') {
    query += ` AND a.action = ?`;
    params.push(action);
  }

  query += ` ORDER BY a.id DESC LIMIT ?`;
  params.push(parseInt(limit, 10));

  const records = db.prepare(query).all(...params);

  return res.json({
    total: records.length,
    records: records.map(r => ({
      ...r,
      details: r.details ? JSON.parse(r.details) : {}
    }))
  });
});

/**
 * GET /api/audit/documents/:documentId
 * Audit history for a specific document
 */
router.get('/documents/:documentId', authenticateToken, (req, res) => {
  const doc = db.prepare('SELECT institution_id FROM documents WHERE id = ?').get(req.params.documentId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Tenant check
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    if (doc.institution_id !== req.user.institution_id) {
      return res.status(403).json({ error: 'Access Denied: Cross-tenant audit viewing prohibited.' });
    }
  }

  const records = db.prepare(`
    SELECT * FROM document_audit_trail 
    WHERE document_id = ? 
    ORDER BY id ASC
  `).all(req.params.documentId);

  return res.json({
    documentId: req.params.documentId,
    totalActions: records.length,
    history: records.map(r => ({
      ...r,
      details: r.details ? JSON.parse(r.details) : {}
    }))
  });
});

/**
 * GET /api/audit/verify-integrity
 * Cryptographic SHA-256 chain verification of audit records
 */
router.get('/verify-integrity', authenticateToken, (req, res) => {
  const result = verifyAuditChainIntegrity();
  return res.json({
    ...result,
    verifiedAt: new Date().toISOString(),
    checkedBy: req.user.username
  });
});

module.exports = router;
