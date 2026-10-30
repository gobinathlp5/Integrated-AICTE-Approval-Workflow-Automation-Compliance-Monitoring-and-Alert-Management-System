const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Valid stage progression sequence under AICTE Approval Process Handbook (APH)
 */
const VALID_TRANSITIONS = {
  APPLICATION_SUBMITTED: ['SCRUTINY', 'UNDER_SCRUTINY', 'ON_HOLD', 'REJECTED'],
  SCRUTINY: ['EVC_INSPECTION', 'UNDER_EVC', 'SCRUTINY_DEFICIENT', 'SAC_HEARING', 'UNDER_SAC', 'ON_HOLD', 'REJECTED'],
  UNDER_SCRUTINY: ['EVC_INSPECTION', 'UNDER_EVC', 'SCRUTINY_DEFICIENT', 'SAC_HEARING', 'UNDER_SAC', 'ON_HOLD', 'REJECTED'],
  SCRUTINY_DEFICIENT: ['SCRUTINY', 'UNDER_SCRUTINY', 'SAC_HEARING', 'UNDER_SAC', 'ON_HOLD', 'REJECTED'],
  EVC_INSPECTION: ['SAC_HEARING', 'UNDER_SAC', 'RC_DECISION', 'COMPETENT_AUTHORITY_REVIEW', 'ON_HOLD', 'REJECTED'],
  UNDER_EVC: ['SAC_HEARING', 'UNDER_SAC', 'RC_DECISION', 'COMPETENT_AUTHORITY_REVIEW', 'EVC_COMPLETED', 'ON_HOLD', 'REJECTED'],
  EVC_COMPLETED: ['RC_DECISION', 'COMPETENT_AUTHORITY_REVIEW', 'SAC_HEARING', 'UNDER_SAC', 'ON_HOLD'],
  SAC_HEARING: ['RC_DECISION', 'COMPETENT_AUTHORITY_REVIEW', 'UNDER_SCRUTINY', 'ON_HOLD', 'REJECTED'],
  UNDER_SAC: ['RC_DECISION', 'COMPETENT_AUTHORITY_REVIEW', 'UNDER_SCRUTINY', 'ON_HOLD', 'REJECTED'],
  RC_DECISION: ['EC_APPROVAL', 'COMPETENT_AUTHORITY_REVIEW', 'ON_HOLD', 'APPROVED', 'REJECTED'],
  COMPETENT_AUTHORITY_REVIEW: ['APPROVED', 'REJECTED', 'UNDER_SCRUTINY', 'ON_HOLD'],
  EC_APPROVAL: ['APPROVED', 'REJECTED', 'ON_HOLD']
};

/**
 * GET /api/workflows/templates
 * List all active workflow templates
 */
router.get('/templates', authenticateToken, (req, res) => {
  const templates = db.prepare('SELECT * FROM workflow_templates WHERE is_active = 1').all();
  const parsed = templates.map(t => ({
    ...t,
    stages: t.stages_json ? JSON.parse(t.stages_json) : []
  }));
  return successResponse(res, { templates: parsed }, 'Workflow templates retrieved successfully');
});

/**
 * GET /api/workflows/templates/:id
 */
router.get('/templates/:id', authenticateToken, (req, res) => {
  const tpl = db.prepare('SELECT * FROM workflow_templates WHERE id = ?').get(req.params.id);
  if (!tpl) {
    return errorResponse(res, 'Workflow template not found', 404, 'NOT_FOUND');
  }
  return successResponse(res, {
    template: {
      ...tpl,
      stages: tpl.stages_json ? JSON.parse(tpl.stages_json) : []
    }
  });
});

/**
 * Common handler for stage transition
 */
function handleTransition(req, res) {
  const applicationId = req.params.applicationId || req.body.applicationId;
  const toStage = req.body.toStage || req.body.nextStage;
  const remarks = req.body.remarks || req.body.transitionRemarks || '';

  if (!applicationId || !toStage) {
    return errorResponse(res, 'applicationId and toStage (or nextStage) are required.', 400, 'VALIDATION_ERROR');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  // Tenant isolation check
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    return errorResponse(res, 'Institutions cannot transition workflow stages.', 403, 'FORBIDDEN');
  }

  if (app.is_on_hold && toStage !== 'RESUMED') {
    return errorResponse(res, `Application is currently placed on statutory hold (${app.hold_reason}). Resume processing first.`, 400, 'APPLICATION_ON_HOLD');
  }

  const fromStage = app.current_stage || app.status || 'APPLICATION_SUBMITTED';

  // Statutory Authority Check:
  // Final decision (APPROVED / REJECTED) is strictly reserved for COMPETENT_AUTHORITY.
  // Super Admin / Platform Admin alone cannot bypass this statutory requirement.
  if (toStage === 'APPROVED' || toStage === 'REJECTED') {
    if (req.user.role !== ROLES.COMPETENT_AUTHORITY) {
      return errorResponse(res, 'Statutory Privilege Violation: Approval or Rejection can only be executed by the authorized Competent Authority under Section 10(k) of the AICTE Act.', 403, 'STATUTORY_AUTHORITY_REQUIRED');
    }

    // Check unresolved deficiencies
    const openDef = db.prepare(`
      SELECT count(*) as count FROM deficiencies 
      WHERE application_id = ? AND status = 'OPEN' AND severity = 'CRITICAL'
    `).get(applicationId);

    if (openDef && openDef.count > 0) {
      return errorResponse(res, `Cannot finalize decision. Application has ${openDef.count} unresolved critical deficiencies.`, 400, 'UNRESOLVED_CRITICAL_DEFICIENCIES');
    }
  }

  // Execute transition within a transaction
  const historyId = 'wfh_' + uuidv4().slice(0, 10);
  const executeTransition = db.transaction(() => {
    db.prepare(`
      UPDATE applications SET
        current_stage = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(toStage, toStage, applicationId);

    db.prepare(`
      INSERT INTO application_workflow_history (
        id, application_id, from_stage, to_stage, transitioned_by, transitioned_by_role, remarks, prerequisites_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(historyId, applicationId, fromStage, toStage, req.user.id, req.user.role, remarks || `Transitioned to ${toStage}`);
  });

  executeTransition();

  // Notify Institution & Officers
  createNotification({
    institutionId: app.institution_id,
    title: `Application Stage Advanced: ${toStage.replace(/_/g, ' ')}`,
    message: `Application ${app.application_number} transitioned from [${fromStage}] to [${toStage}]. Remarks: ${remarks || 'None'}`,
    type: toStage === 'SCRUTINY_DEFICIENT' ? 'DEFICIENCY' : toStage === 'APPROVED' ? 'SUCCESS' : 'INFO',
    link: '/applications'
  });

  return successResponse(res, {
    currentStage: toStage,
    fromStage,
    historyId,
    applicationId
  }, `Application transitioned from [${fromStage}] to [${toStage}].`);
}

// Canonical and Alias Transition Routes
router.post('/transition', authenticateToken, handleTransition);
router.post('/applications/:applicationId/transition', authenticateToken, handleTransition);

/**
 * Common handler for statutory hold
 */
function handleHold(req, res) {
  const applicationId = req.params.applicationId || req.body.applicationId;
  const reason = req.body.reason || req.body.holdReason;

  if (!applicationId || !reason) {
    return errorResponse(res, 'applicationId and reason are required.', 400, 'VALIDATION_ERROR');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  const canHold = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.COMPETENT_AUTHORITY].includes(req.user.role);
  if (!canHold) {
    return errorResponse(res, 'User role not authorized to place applications on hold.', 403, 'FORBIDDEN');
  }

  db.prepare(`
    UPDATE applications SET
      is_on_hold = 1,
      hold_reason = ?,
      hold_by = ?,
      hold_at = CURRENT_TIMESTAMP,
      status = 'ON_HOLD',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reason, req.user.full_name, applicationId);

  createNotification({
    institutionId: app.institution_id,
    title: 'Application Placed On Statutory Hold',
    message: `Application ${app.application_number} has been placed on statutory hold: ${reason}`,
    type: 'WARNING',
    link: '/applications'
  });

  return successResponse(res, { applicationId, status: 'ON_HOLD' }, 'Application placed on statutory hold.');
}

router.post('/hold', authenticateToken, handleHold);
router.post('/applications/:applicationId/hold', authenticateToken, handleHold);

/**
 * Common handler for resume
 */
function handleResume(req, res) {
  const applicationId = req.params.applicationId || req.body.applicationId;
  const remarks = req.body.remarks || req.body.resumeRemarks || 'Administrative review completed';

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  const canResume = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.COMPETENT_AUTHORITY].includes(req.user.role);
  if (!canResume) {
    return errorResponse(res, 'User role not authorized to resume applications.', 403, 'FORBIDDEN');
  }

  const resumeStage = app.current_stage || 'UNDER_SCRUTINY';

  db.prepare(`
    UPDATE applications SET
      is_on_hold = 0,
      hold_reason = NULL,
      hold_by = NULL,
      hold_at = NULL,
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(resumeStage, applicationId);

  createNotification({
    institutionId: app.institution_id,
    title: 'Application Processing Resumed',
    message: `Application ${app.application_number} processing resumed at stage: ${resumeStage}.`,
    type: 'INFO',
    link: '/applications'
  });

  return successResponse(res, { applicationId, currentStage: resumeStage }, `Application resumed at stage [${resumeStage}].`);
}

router.post('/resume', authenticateToken, handleResume);
router.post('/applications/:applicationId/resume', authenticateToken, handleResume);

/**
 * GET History: both /history/:applicationId and /applications/:applicationId/history
 */
function handleHistory(req, res) {
  const applicationId = req.params.applicationId;
  const history = db.prepare(`
    SELECT * FROM application_workflow_history 
    WHERE application_id = ? 
    ORDER BY created_at ASC
  `).all(applicationId);

  return successResponse(res, history, 'Workflow history retrieved');
}

router.get('/history/:applicationId', authenticateToken, handleHistory);
router.get('/applications/:applicationId/history', authenticateToken, handleHistory);

module.exports = router;
