const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * GET /api/sac/hearings
 * List all Standing Appellate / Hearing Committee proceedings
 */
router.get('/hearings', authenticateToken, (req, res) => {
  let query = `
    SELECT h.*, c.name as committee_name, c.code as committee_code, c.type as committee_type,
           a.application_number, a.academic_year,
           i.name as institution_name, i.code as institution_code,
           h.scheduled_at as scheduled_date
    FROM sac_hearings h
    LEFT JOIN sac_committees c ON h.committee_id = c.id
    LEFT JOIN applications a ON h.application_id = a.id
    LEFT JOIN institutions i ON a.institution_id = i.id
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

  return successResponse(res, hearings, 'SAC hearings retrieved');
});

/**
 * GET /api/sac/hearings/:id or /api/sac/hearings/application/:applicationId
 */
function handleGetHearing(req, res) {
  const param = req.params.id || req.params.applicationId;
  const hearing = db.prepare(`
    SELECT h.*, c.name as committee_name, c.code as committee_code,
           a.application_number, i.name as institution_name,
           h.scheduled_at as scheduled_date
    FROM sac_hearings h
    LEFT JOIN sac_committees c ON h.committee_id = c.id
    LEFT JOIN applications a ON h.application_id = a.id
    LEFT JOIN institutions i ON a.institution_id = i.id
    WHERE h.id = ? OR h.application_id = ?
  `).get(param, param);

  if (!hearing) {
    return errorResponse(res, 'Hearing record not found', 404, 'NOT_FOUND');
  }

  return successResponse(res, hearing, 'Hearing details retrieved');
}

router.get('/hearings/:id', authenticateToken, handleGetHearing);
router.get('/hearings/application/:applicationId', authenticateToken, handleGetHearing);

/**
 * POST /api/sac/hearings/schedule
 */
router.post('/hearings/schedule', authenticateToken, (req, res) => {
  const { applicationId, scheduledDate, scheduledAt, meetingMode, committeeChair, committeeMembers, appellantName, hearingSummary } = req.body;
  let committeeId = req.body.committeeId;

  const finalDate = scheduledDate || scheduledAt;
  if (!applicationId || !finalDate) {
    return errorResponse(res, 'applicationId and scheduledDate are required.', 400, 'VALIDATION_ERROR');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  if (!committeeId) {
    committeeId = 'sac_comm_' + uuidv4().slice(0, 8);
    db.prepare(`
      INSERT INTO sac_committees (id, code, name, type)
      VALUES (?, ?, ?, 'SAC')
    `).run(committeeId, 'SAC-' + Math.floor(1000 + Math.random() * 9000), `Standing Appellate Committee for ${app.application_number}`);
  }

  const hearingId = 'sach_' + uuidv4().slice(0, 10);
  db.prepare(`
    INSERT INTO sac_hearings (
      id, committee_id, application_id, scheduled_at, meeting_mode, committee_chair, committee_members, appellant_name, hearing_summary, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED')
  `).run(
    hearingId,
    committeeId,
    applicationId,
    finalDate,
    meetingMode || 'VIRTUAL',
    committeeChair || 'Prof. K. Murthy (Retd. High Court Justice)',
    committeeMembers || 'Prof. S. R. Rao, Dr. Ananya Sen',
    appellantName || 'Authorized Institution Representative',
    hearingSummary || 'Statutory Appeal Proceeding'
  );

  db.prepare("UPDATE applications SET status = 'UNDER_SAC', current_stage = 'UNDER_SAC' WHERE id = ?").run(applicationId);

  createNotification({
    institutionId: app.institution_id,
    title: 'SAC/SHC Appellate Hearing Scheduled',
    message: `Standing Appellate Committee hearing scheduled for ${finalDate} regarding application ${app.application_number}.`,
    type: 'INFO',
    link: '/sac'
  });

  return successResponse(res, { hearingId, scheduledDate: finalDate }, 'SAC Appellate Hearing docket registered successfully.', 201);
});

/**
 * Common handler for recording recommendation
 */
function handleRecommend(req, res) {
  const { observations, reasoning, recommendation, conditionNotes, condition_notes, status = 'CONCLUDED' } = req.body;
  const hearingId = req.params.id;

  const hearing = db.prepare('SELECT * FROM sac_hearings WHERE id = ?').get(hearingId);
  if (!hearing) {
    return errorResponse(res, 'Hearing record not found', 404, 'NOT_FOUND');
  }

  const finalReasoning = reasoning || observations || '';
  const finalRec = recommendation || 'REVERSAL_APPROVED';
  const finalCondition = conditionNotes || condition_notes || '';

  db.prepare(`
    UPDATE sac_hearings SET
      reasoning = ?,
      observations = ?,
      recommendation = ?,
      condition_notes = ?,
      status = ?
    WHERE id = ?
  `).run(finalReasoning, finalReasoning, finalRec, finalCondition, status, hearing.id);

  db.prepare("UPDATE applications SET current_stage = 'COMPETENT_AUTHORITY_REVIEW' WHERE id = ?").run(hearing.application_id);

  return successResponse(res, { hearingId, recommendation: finalRec, status }, 'SAC Judicial Recommendation recorded.');
}

router.post('/hearings/:id/recommend', authenticateToken, handleRecommend);
router.post('/hearings/:id/recommendation', authenticateToken, handleRecommend);

module.exports = router;
