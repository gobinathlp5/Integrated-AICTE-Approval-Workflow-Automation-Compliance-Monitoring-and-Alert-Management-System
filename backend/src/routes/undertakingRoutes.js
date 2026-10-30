const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');

/**
 * GET /api/undertakings/templates
 * List statutory undertaking templates (Anti-Ragging, Land Contiguity, Faculty Cadre, Compliance)
 */
router.get('/templates', authenticateToken, (req, res) => {
  const templates = db.prepare('SELECT * FROM undertaking_templates ORDER BY created_at ASC').all();
  return res.json({ templates });
});

/**
 * GET /api/undertakings
 * List submitted undertakings with status and validity
 */
router.get('/', authenticateToken, (req, res) => {
  let query = `
    SELECT u.*, t.code as template_code, t.category as template_category,
           i.name as institution_name, i.code as institution_code,
           doc.file_name, doc.document_number
    FROM undertakings u
    JOIN undertaking_templates t ON u.template_id = t.id
    JOIN institutions i ON u.institution_id = i.id
    LEFT JOIN documents doc ON u.document_id = doc.id
    WHERE 1=1
  `;
  const params = [];

  // Institution tenant isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ` AND u.institution_id = ?`;
    params.push(req.user.institution_id);
  }

  query += ` ORDER BY u.created_at DESC`;
  const undertakings = db.prepare(query).all(...params);

  // Compute expiry state
  const now = new Date();
  const enriched = undertakings.map(u => {
    let expiryState = 'VALID';
    if (u.valid_until) {
      const expDate = new Date(u.valid_until);
      const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) expiryState = 'EXPIRED';
      else if (diffDays <= 60) expiryState = 'EXPIRING_SOON';
    }
    return { ...u, computed_expiry_state: expiryState };
  });

  return res.json({
    total: enriched.length,
    undertakings: enriched
  });
});

/**
 * POST /api/undertakings/submit
 * Institution submits signed statutory undertaking
 */
router.post('/submit', authenticateToken, (req, res) => {
  const { templateId, applicationId, title, documentId, validFrom, validUntil } = req.body;

  if (!templateId || !title) {
    return res.status(400).json({ error: 'templateId and title are required.' });
  }

  const instId = (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF)
    ? req.user.institution_id
    : (req.body.institutionId || 'inst_delhi_001');

  const utId = 'ut_' + uuidv4().slice(0, 10);
  db.prepare(`
    INSERT INTO undertakings (
      id, template_id, institution_id, application_id, title, status,
      document_id, valid_from, valid_until
    ) VALUES (?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, ?)
  `).run(
    utId,
    templateId,
    instId,
    applicationId || null,
    title,
    documentId || null,
    validFrom || new Date().toISOString().split('T')[0],
    validUntil || null
  );

  createNotification({
    roleTarget: ROLES.SCRUTINY_OFFICER,
    title: 'New Statutory Undertaking Submitted',
    message: `Institution submitted undertaking "${title}" for statutory verification.`,
    type: 'INFO',
    link: '/undertakings'
  });

  return res.status(201).json({
    success: true,
    message: 'Statutory undertaking submitted and registered in repository.',
    undertakingId: utId
  });
});

/**
 * POST /api/undertakings/:id/verify
 * Officer verifies or rejects submitted undertaking
 */
router.post('/:id/verify', authenticateToken, (req, res) => {
  const { status, remarks } = req.body;

  const ut = db.prepare('SELECT * FROM undertakings WHERE id = ?').get(req.params.id);
  if (!ut) {
    return res.status(404).json({ error: 'Undertaking record not found' });
  }

  db.prepare(`
    UPDATE undertakings SET
      status = ?,
      verification_remarks = ?,
      verified_by = ?,
      verified_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status || 'VERIFIED', remarks || 'Verified and found compliant.', req.user.full_name, ut.id);

  createNotification({
    institutionId: ut.institution_id,
    title: `Undertaking ${status === 'VERIFIED' ? 'Verified' : 'Rejected'}`,
    message: `Your undertaking "${ut.title}" was marked as ${status}. Remarks: ${remarks || 'None'}`,
    type: status === 'VERIFIED' ? 'SUCCESS' : 'WARNING',
    link: '/undertakings'
  });

  return res.json({
    success: true,
    message: `Undertaking verification status committed as [${status}].`
  });
});

module.exports = router;
