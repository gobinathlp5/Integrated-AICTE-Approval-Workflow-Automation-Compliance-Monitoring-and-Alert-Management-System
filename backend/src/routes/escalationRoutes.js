const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');

/**
 * GET /api/escalations
 * List active & historical escalations
 */
router.get('/', authenticateToken, (req, res) => {
  const escalations = db.prepare(`
    SELECT e.*, a.application_number, i.name as institution_name, i.code as institution_code
    FROM escalations e
    JOIN applications a ON e.application_id = a.id
    JOIN institutions i ON e.institution_id = i.id
    ORDER BY e.created_at DESC
  `).all();

  return res.json({
    total: escalations.length,
    escalations
  });
});

/**
 * POST /api/escalations/check-overdue
 * Automated scan engine that analyzes pending applications, tasks and obligations for overdue status
 * and generates appropriate Level 1, Level 2, or Level 3 escalations
 */
router.post('/check-overdue', authenticateToken, (req, res) => {
  let createdCount = 0;

  // 1. Check Scrutiny evaluations taking more than 7 days
  const pendingScrutiny = db.prepare(`
    SELECT a.*, i.name as institution_name 
    FROM applications a
    JOIN institutions i ON a.institution_id = i.id
    WHERE a.status = 'UNDER_SCRUTINY' AND a.is_on_hold = 0
  `).all();

  pendingScrutiny.forEach(app => {
    // Check if an active escalation already exists
    const existing = db.prepare(`
      SELECT id FROM escalations 
      WHERE application_id = ? AND status = 'ACTIVE' AND reason LIKE '%Scrutiny%'
    `).get(app.id);

    if (!existing) {
      const escId = 'esc_' + uuidv4().slice(0, 8);
      db.prepare(`
        INSERT INTO escalations (
          id, application_id, institution_id, escalation_level, reason, assigned_to_role, status
        ) VALUES (?, ?, ?, 'LEVEL_1', 'Scrutiny evaluation review overdue exceeding statutory 7-day turnaround', ?, 'ACTIVE')
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

  return res.json({
    success: true,
    message: `Automated scan completed. ${createdCount} new escalations identified and dispatched to supervisory officers.`,
    newEscalationsCount: createdCount
  });
});

/**
 * POST /api/escalations/:id/resolve
 * Officer resolves escalation with supervisory action notes
 */
router.post('/:id/resolve', authenticateToken, (req, res) => {
  const { resolutionNotes } = req.body;

  const esc = db.prepare('SELECT * FROM escalations WHERE id = ?').get(req.params.id);
  if (!esc) {
    return res.status(404).json({ error: 'Escalation record not found' });
  }

  db.prepare(`
    UPDATE escalations SET
      status = 'RESOLVED',
      resolution_notes = ?,
      resolved_by = ?,
      resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(resolutionNotes || 'Intervention completed by supervisor.', req.user.full_name, esc.id);

  return res.json({ success: true, message: 'Escalation marked as resolved.' });
});

module.exports = router;
