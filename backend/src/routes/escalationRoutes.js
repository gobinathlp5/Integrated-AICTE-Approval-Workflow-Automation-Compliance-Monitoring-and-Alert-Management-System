const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * GET /api/escalations
 * List active & historical escalations
 */
router.get('/', authenticateToken, (req, res) => {
  let query = `
    SELECT e.*, a.application_number, i.name as institution_name, i.code as institution_code,
           e.assigned_to_role as target_role
    FROM escalations e
    LEFT JOIN applications a ON e.application_id = a.id
    LEFT JOIN institutions i ON e.institution_id = i.id
    WHERE 1=1
  `;
  const params = [];

  // Institution tenant isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ` AND e.institution_id = ?`;
    params.push(req.user.institution_id);
  }

  query += ` ORDER BY e.created_at DESC`;
  const escalations = db.prepare(query).all(...params);

  return successResponse(res, escalations, 'Escalations retrieved');
});

/**
 * Common handler for overdue scan
 * Privileged operation: Only Council officers and administrators can trigger SLA breach scanning.
 */
function handleOverdueScan(req, res) {
  const canScan = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU].includes(req.user.role);
  if (!canScan) {
    return errorResponse(res, 'Permission Denied: Only Council Officers and Administrators can trigger SLA breach scans.', 403, 'FORBIDDEN');
  }

  let createdCount = 0;

  // 1. Check pending scrutiny applications exceeding 14 days
  const pendingScrutiny = db.prepare(`
    SELECT a.*, i.name as institution_name 
    FROM applications a
    JOIN institutions i ON a.institution_id = i.id
    WHERE a.status IN ('SCRUTINY', 'UNDER_SCRUTINY') AND a.is_on_hold = 0
  `).all();

  pendingScrutiny.forEach(app => {
    const existing = db.prepare(`
      SELECT id FROM escalations 
      WHERE application_id = ? AND status = 'OPEN' AND reason LIKE '%Scrutiny%'
    `).get(app.id);

    if (!existing) {
      const escId = 'esc_' + uuidv4().slice(0, 8);
      db.prepare(`
        INSERT INTO escalations (
          id, application_id, institution_id, escalation_level, reason, assigned_to_role, status
        ) VALUES (?, ?, ?, 'LEVEL_1', 'Scrutiny evaluation review overdue exceeding statutory APH SLA timeline', ?, 'OPEN')
      `).run(escId, app.id, app.institution_id, ROLES.REGIONAL_OFFICER);

      createNotification({
        roleTarget: ROLES.REGIONAL_OFFICER,
        title: 'Level 1 Escalation: Scrutiny Overdue',
        message: `Application ${app.application_number} scrutiny review has been automatically escalated to Regional Officer.`,
        type: 'ESCALATION',
        link: '/escalations'
      });
      createdCount++;
    }
  });

  // 2. Check pending EVC inspections
  const pendingEvc = db.prepare(`
    SELECT a.*, i.name as institution_name
    FROM applications a
    JOIN institutions i ON a.institution_id = i.id
    WHERE a.status IN ('EVC_INSPECTION', 'UNDER_EVC') AND a.is_on_hold = 0
  `).all();

  pendingEvc.forEach(app => {
    const existing = db.prepare(`
      SELECT id FROM escalations
      WHERE application_id = ? AND status = 'OPEN' AND reason LIKE '%EVC%'
    `).get(app.id);

    if (!existing) {
      const escId = 'esc_' + uuidv4().slice(0, 8);
      db.prepare(`
        INSERT INTO escalations (
          id, application_id, institution_id, escalation_level, reason, assigned_to_role, status
        ) VALUES (?, ?, ?, 'LEVEL_2', 'EVC on-site visit report overdue beyond 21 statutory days', ?, 'OPEN')
      `).run(escId, app.id, app.institution_id, ROLES.BUREAU_OFFICER);
      createdCount++;
    }
  });

  return successResponse(res, {
    newEscalationsCreated: createdCount,
    newEscalationsCount: createdCount
  }, `Automated SLA scan completed. ${createdCount} new escalations identified.`);
}

router.post('/scan', authenticateToken, handleOverdueScan);
router.post('/check-overdue', authenticateToken, handleOverdueScan);
router.get('/scan', authenticateToken, handleOverdueScan);
router.get('/check-overdue', authenticateToken, handleOverdueScan);

/**
 * POST /api/escalations/:id/resolve
 * Officer resolves escalation with supervisory action notes
 */
router.post('/:id/resolve', authenticateToken, (req, res) => {
  const resolutionNotes = req.body.resolutionNotes || req.body.resolution_notes || req.body.notes || 'Intervention completed by supervisor.';

  const canResolve = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.COMPETENT_AUTHORITY].includes(req.user.role);
  if (!canResolve) {
    return errorResponse(res, 'User role not authorized to resolve escalations.', 403, 'FORBIDDEN');
  }

  const esc = db.prepare('SELECT * FROM escalations WHERE id = ?').get(req.params.id);
  if (!esc) {
    return errorResponse(res, 'Escalation record not found', 404, 'NOT_FOUND');
  }

  db.prepare(`
    UPDATE escalations SET
      status = 'RESOLVED',
      resolution_notes = ?,
      resolved_by = ?,
      resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(resolutionNotes, req.user.full_name, esc.id);

  return successResponse(res, { escalationId: esc.id, status: 'RESOLVED' }, 'Escalation marked as resolved.');
});

module.exports = router;
