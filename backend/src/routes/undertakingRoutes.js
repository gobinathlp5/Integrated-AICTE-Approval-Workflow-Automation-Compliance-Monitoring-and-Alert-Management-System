const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken, optionalAuth } = require('../auth');
const { createNotification } = require('../notificationService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * GET /api/undertakings/templates
 */
router.get('/templates', optionalAuth, (req, res) => {
  const templates = db.prepare('SELECT * FROM undertaking_templates ORDER BY created_at ASC').all();
  return successResponse(res, templates, 'Undertaking templates retrieved');
});

/**
 * GET /api/undertakings
 * List submitted undertakings with status and validity
 */
router.get('/', authenticateToken, (req, res) => {
  let query = `
    SELECT u.*, t.code as template_code, t.category as template_category, t.title as template_title,
           i.name as institution_name, i.code as institution_code,
           u.valid_until as validity_date, u.status as verification_status
    FROM undertakings u
    LEFT JOIN undertaking_templates t ON u.template_id = t.id
    LEFT JOIN institutions i ON u.institution_id = i.id
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

  return successResponse(res, undertakings, 'Undertakings retrieved');
});

/**
 * GET /api/undertakings/submissions/:applicationId
 */
router.get('/submissions/:applicationId', authenticateToken, (req, res) => {
  const { applicationId } = req.params;
  const submissions = db.prepare(`
    SELECT u.*, t.title as template_title, t.code as template_code,
           u.valid_until as validity_date, u.status as verification_status
    FROM undertakings u
    LEFT JOIN undertaking_templates t ON u.template_id = t.id
    WHERE u.application_id = ?
    ORDER BY u.created_at DESC
  `).all(applicationId);

  return successResponse(res, submissions, 'Submissions retrieved');
});

/**
 * POST /api/undertakings/submit
 * Institution submits signed statutory undertaking
 */
router.post('/submit', authenticateToken, (req, res) => {
  const { templateId, applicationId, title, documentId, validFrom, validUntil, validityDate, remarks } = req.body;

  if (!templateId) {
    return errorResponse(res, 'templateId is required.', 400, 'VALIDATION_ERROR');
  }

  // Enforce institution ownership
  let instId;
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    instId = req.user.institution_id;
  } else {
    // For admin or officer testing, resolve from application or fallback
    if (applicationId) {
      const app = db.prepare('SELECT institution_id FROM applications WHERE id = ?').get(applicationId);
      instId = app ? app.institution_id : 'inst_delhi_001';
    } else {
      instId = req.body.institutionId || 'inst_delhi_001';
    }
  }

  // Get template title if not provided
  const tmpl = db.prepare('SELECT title FROM undertaking_templates WHERE id = ?').get(templateId);
  const finalTitle = title || (tmpl ? tmpl.title : 'Statutory Undertaking');
  const finalValidity = validityDate || validUntil || '2027-06-30';

  const utId = 'ut_' + uuidv4().slice(0, 10);
  db.prepare(`
    INSERT INTO undertakings (
      id, template_id, institution_id, application_id, title, status,
      document_id, valid_from, valid_until, remarks
    ) VALUES (?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, ?, ?)
  `).run(
    utId,
    templateId,
    instId,
    applicationId || null,
    finalTitle,
    documentId || null,
    validFrom || new Date().toISOString().split('T')[0],
    finalValidity,
    remarks || ''
  );

  createNotification({
    roleTarget: ROLES.SCRUTINY_OFFICER,
    title: 'New Statutory Undertaking Filed',
    message: `Institution filed undertaking "${finalTitle}" for statutory verification.`,
    type: 'INFO',
    link: '/undertakings'
  });

  return successResponse(res, { id: utId, undertakingId: utId, title: finalTitle }, 'Statutory undertaking submitted successfully.', 201);
});

/**
 * POST /api/undertakings/:id/verify
 */
router.post('/:id/verify', authenticateToken, (req, res) => {
  const { status = 'VALID', verificationRemarks, remarks } = req.body;

  const canVerify = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.SCRUTINY_OFFICER].includes(req.user.role);
  if (!canVerify) {
    return errorResponse(res, 'User role not authorized to verify undertakings.', 403, 'FORBIDDEN');
  }

  const ut = db.prepare('SELECT * FROM undertakings WHERE id = ?').get(req.params.id);
  if (!ut) {
    return errorResponse(res, 'Undertaking not found', 404, 'NOT_FOUND');
  }

  const finalRemarks = verificationRemarks || remarks || 'Verified in order as per statutory format.';

  db.prepare(`
    UPDATE undertakings SET
      status = ?,
      verification_remarks = ?,
      verified_by_user_id = ?,
      verified_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, finalRemarks, req.user.id, ut.id);

  return successResponse(res, { undertakingId: ut.id, status }, `Undertaking verification recorded as [${status}].`);
});

module.exports = router;
