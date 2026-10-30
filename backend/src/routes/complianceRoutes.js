const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');

/**
 * GET /api/compliance/obligations
 * List compliance items with status, due dates, and penalty clauses
 */
router.get('/obligations', authenticateToken, (req, res) => {
  let query = `
    SELECT c.*, i.name as institution_name, i.code as institution_code,
           doc.title as evidence_doc_title, doc.document_number as evidence_doc_number
    FROM compliance_obligations c
    JOIN institutions i ON c.institution_id = i.id
    LEFT JOIN documents doc ON c.evidence_doc_id = doc.id
    WHERE 1=1
  `;
  const params = [];

  // Tenant isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ` AND c.institution_id = ?`;
    params.push(req.user.institution_id);
  }

  query += ` ORDER BY c.due_date ASC`;
  const obligations = db.prepare(query).all(...params);

  const now = new Date();
  const enriched = obligations.map(o => {
    const dueDate = new Date(o.due_date);
    const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    let statusCategory = o.status;
    if (diffDays < 0 && o.status === 'PENDING') {
      statusCategory = 'OVERDUE';
    } else if (diffDays <= 30 && o.status === 'PENDING') {
      statusCategory = 'DUE_SOON';
    }
    return {
      ...o,
      days_remaining: diffDays,
      computed_state: statusCategory
    };
  });

  return res.json({
    total: enriched.length,
    obligations: enriched
  });
});

/**
 * GET /api/compliance/summary/:institutionId
 * Aggregate compliance scorecard & profile
 */
router.get('/summary/:institutionId', authenticateToken, (req, res) => {
  const inst = db.prepare('SELECT * FROM institutions WHERE id = ?').get(req.params.institutionId);
  if (!inst) {
    return res.status(404).json({ error: 'Institution not found' });
  }

  const obligations = db.prepare('SELECT * FROM compliance_obligations WHERE institution_id = ?').all(inst.id);

  const total = obligations.length;
  const verified = obligations.filter(o => o.status === 'VERIFIED').length;
  const pending = obligations.filter(o => o.status === 'PENDING').length;
  const overdue = obligations.filter(o => new Date(o.due_date) < new Date() && o.status === 'PENDING').length;

  const score = total > 0 ? Math.round((verified / total) * 100) : inst.compliance_score;

  return res.json({
    institutionId: inst.id,
    institutionName: inst.name,
    complianceScore: score,
    totalObligations: total,
    verifiedCount: verified,
    pendingCount: pending,
    overdueCount: overdue,
    grade: score >= 90 ? 'A+ (Exemplary)' : score >= 75 ? 'A (Compliant)' : 'B (Action Required)'
  });
});

/**
 * POST /api/compliance/obligations/:id/submit-evidence
 * Submit compliance evidence document
 */
router.post('/obligations/:id/submit-evidence', authenticateToken, (req, res) => {
  const { evidenceDocId } = req.body;

  const ob = db.prepare('SELECT * FROM compliance_obligations WHERE id = ?').get(req.params.id);
  if (!ob) {
    return res.status(404).json({ error: 'Compliance obligation not found' });
  }

  db.prepare(`
    UPDATE compliance_obligations SET
      evidence_doc_id = ?,
      status = 'SUBMITTED'
    WHERE id = ?
  `).run(evidenceDocId || null, ob.id);

  return res.json({ success: true, message: 'Compliance evidence submitted for verification.' });
});

/**
 * POST /api/compliance/obligations/:id/verify
 * Officer verifies compliance evidence
 */
router.post('/obligations/:id/verify', authenticateToken, (req, res) => {
  const { status, remarks } = req.body;

  const ob = db.prepare('SELECT * FROM compliance_obligations WHERE id = ?').get(req.params.id);
  if (!ob) {
    return res.status(404).json({ error: 'Compliance obligation not found' });
  }

  db.prepare(`
    UPDATE compliance_obligations SET
      status = ?,
      verified_by = ?,
      verified_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status || 'VERIFIED', req.user.full_name, ob.id);

  return res.json({ success: true, message: `Compliance obligation updated to [${status}].` });
});

module.exports = router;
