const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');

/**
 * GET /api/sac/hearings
 * List all Standing Appellate / Hearing Committee proceedings
 */
router.get('/hearings', authenticateToken, (req, res) => {
  let query = `
    SELECT h.*, c.name as committee_name, c.code as committee_code, c.type as committee_type,
           a.application_number, a.academic_year,
           i.name as institution_name, i.code as institution_code
    FROM sac_hearings h
    JOIN sac_committees c ON h.committee_id = c.id
    JOIN applications a ON h.application_id = a.id
    JOIN institutions i ON a.institution_id = i.id
    WHERE 1=1
  `;
  const params = [];

  // Institution tenant isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ` AND a.institution_id = ?`;
    params.push(req.user.institution_id);
  }

  query += ` ORDER BY h.scheduled_at ASC`;
  const hearings = db.prepare(query).all(...params);

  return res.json({
    total: hearings.length,
    hearings
  });
});

/**
 * POST /api/sac/hearings/schedule
 * Schedule SAC/SHC hearing for an application
 */
router.post('/hearings/schedule', authenticateToken, (req, res) => {
  const { committeeId, applicationId, scheduledAt, appellantName, hearingSummary } = req.body;

  if (!committeeId || !applicationId || !scheduledAt) {
    return res.status(400).json({ error: 'committeeId, applicationId, and scheduledAt are required.' });
  }

  const hearingId = 'sach_' + uuidv4().slice(0, 10);
  db.prepare(`
    INSERT INTO sac_hearings (id, committee_id, application_id, scheduled_at, appellant_name, hearing_summary, status)
    VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED')
  `).run(hearingId, committeeId, applicationId, scheduledAt, appellantName || 'Authorized Institution Representative', hearingSummary || 'Statutory Appeal Proceeding');

  // Advance application stage to UNDER_SAC
  db.prepare("UPDATE applications SET status = 'UNDER_SAC', current_stage = 'UNDER_SAC' WHERE id = ?").run(applicationId);

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);

  createNotification({
    institutionId: app.institution_id,
    title: 'SAC/SHC Appellate Hearing Scheduled',
    message: `Standing Appellate Committee hearing scheduled for ${scheduledAt} regarding application ${app.application_number}.`,
    type: 'INFO',
    link: '/sac'
  });

  return res.status(201).json({
    success: true,
    message: 'SAC Appellate Hearing docket registered successfully.',
    hearingId
  });
});

/**
 * POST /api/sac/hearings/:id/recommend
 * SAC Committee records its formal recommendation (non-final advisory)
 */
router.post('/hearings/:id/recommend', authenticateToken, (req, res) => {
  const { observations, recommendation, status = 'COMPLETED' } = req.body;

  const hearing = db.prepare('SELECT * FROM sac_hearings WHERE id = ?').get(req.params.id);
  if (!hearing) {
    return res.status(404).json({ error: 'Hearing record not found' });
  }

  db.prepare(`
    UPDATE sac_hearings SET
      observations = ?,
      recommendation = ?,
      status = ?
    WHERE id = ?
  `).run(observations || '', recommendation || 'APPROVE_GRANT', status, hearing.id);

  // Transition application to COMPETENT_AUTHORITY_REVIEW
  db.prepare("UPDATE applications SET current_stage = 'COMPETENT_AUTHORITY_REVIEW' WHERE id = ?").run(hearing.application_id);

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(hearing.application_id);

  createNotification({
    roleTarget: ROLES.COMPETENT_AUTHORITY,
    title: 'SAC Recommendation Submitted for Final Decision',
    message: `SAC Committee submitted formal recommendation (${recommendation}) on application ${app ? app.application_number : ''}.`,
    type: 'INFO',
    link: '/decisions'
  });

  return res.json({
    success: true,
    message: 'SAC Committee recommendation formally submitted to Competent Authority docket.'
  });
});

module.exports = router;
