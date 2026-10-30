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
 * Enforces strict non-arbitrary progression through regulatory stages.
 */
const VALID_TRANSITIONS = {
  SUBMITTED: ['UNDER_SCRUTINY', 'SCRUTINY', 'ON_HOLD', 'REJECTED'],
  APPLICATION_SUBMITTED: ['UNDER_SCRUTINY', 'SCRUTINY', 'ON_HOLD', 'REJECTED'],
  SCRUTINY: ['UNDER_EVC', 'EVC_INSPECTION', 'SCRUTINY_DEFICIENT', 'UNDER_SAC', 'SAC_HEARING', 'ON_HOLD', 'REJECTED'],
  UNDER_SCRUTINY: ['UNDER_EVC', 'EVC_INSPECTION', 'SCRUTINY_DEFICIENT', 'UNDER_SAC', 'SAC_HEARING', 'ON_HOLD', 'REJECTED'],
  SCRUTINY_DEFICIENT: ['UNDER_SCRUTINY', 'SCRUTINY', 'UNDER_SAC', 'SAC_HEARING', 'ON_HOLD', 'REJECTED'],
  EVC_INSPECTION: ['EVC_COMPLETED', 'UNDER_SAC', 'SAC_HEARING', 'RC_DECISION', 'COMPETENT_AUTHORITY_REVIEW', 'ON_HOLD', 'REJECTED'],
  UNDER_EVC: ['EVC_COMPLETED', 'UNDER_SAC', 'SAC_HEARING', 'RC_DECISION', 'COMPETENT_AUTHORITY_REVIEW', 'ON_HOLD', 'REJECTED'],
  EVC_COMPLETED: ['RC_DECISION', 'COMPETENT_AUTHORITY_REVIEW', 'UNDER_SAC', 'SAC_HEARING', 'ON_HOLD'],
  SAC_HEARING: ['RC_DECISION', 'COMPETENT_AUTHORITY_REVIEW', 'UNDER_SCRUTINY', 'ON_HOLD', 'REJECTED'],
  UNDER_SAC: ['RC_DECISION', 'COMPETENT_AUTHORITY_REVIEW', 'UNDER_SCRUTINY', 'ON_HOLD', 'REJECTED'],
  RC_DECISION: ['EC_APPROVAL', 'COMPETENT_AUTHORITY_REVIEW', 'ON_HOLD', 'APPROVED', 'REJECTED'],
  COMPETENT_AUTHORITY_REVIEW: ['APPROVED', 'REJECTED', 'UNDER_SCRUTINY', 'ON_HOLD'],
  EC_APPROVAL: ['APPROVED', 'REJECTED', 'ON_HOLD']
};

/**
 * Role permissions matrix for initiating transitions to given target stages
 */
const STAGE_PERMITTED_ROLES = {
  UNDER_SCRUTINY: [ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.SCRUTINY_OFFICER, ROLES.SAC_SHC_MEMBER, ROLES.COMPETENT_AUTHORITY],
  SCRUTINY: [ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.SCRUTINY_OFFICER],
  SCRUTINY_DEFICIENT: [ROLES.SCRUTINY_OFFICER, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.SUPER_ADMIN],
  UNDER_EVC: [ROLES.SCRUTINY_OFFICER, ROLES.EVC_COORDINATOR, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.SUPER_ADMIN],
  EVC_INSPECTION: [ROLES.SCRUTINY_OFFICER, ROLES.EVC_COORDINATOR, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.SUPER_ADMIN],
  EVC_COMPLETED: [ROLES.EVC_COORDINATOR, ROLES.EVC_MEMBER, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.SUPER_ADMIN],
  UNDER_SAC: [ROLES.SAC_SHC_MEMBER, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.SUPER_ADMIN],
  SAC_HEARING: [ROLES.SAC_SHC_MEMBER, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.SUPER_ADMIN],
  RC_DECISION: [ROLES.EVC_COORDINATOR, ROLES.SAC_SHC_MEMBER, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.SUPER_ADMIN],
  COMPETENT_AUTHORITY_REVIEW: [ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.SUPER_ADMIN, ROLES.EVC_COORDINATOR, ROLES.SAC_SHC_MEMBER],
  EC_APPROVAL: [ROLES.REGULATION_BUREAU, ROLES.SUPER_ADMIN],
  APPROVED: [ROLES.COMPETENT_AUTHORITY],
  REJECTED: [ROLES.COMPETENT_AUTHORITY],
  ON_HOLD: [ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.COMPETENT_AUTHORITY, ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN]
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
 * Common handler for stage transition with strict validation, role checks, and race condition prevention
 */
function handleTransition(req, res) {
  const applicationId = req.params.applicationId || req.body.applicationId;
  const toStageRaw = req.body.toStage || req.body.nextStage;
  const remarks = req.body.remarks || req.body.transitionRemarks || '';

  if (!applicationId || !toStageRaw) {
    return errorResponse(res, 'applicationId and toStage (or nextStage) are required.', 400, 'VALIDATION_ERROR');
  }

  const toStage = toStageRaw.trim();

  // 1. Tenant & Role checks
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    return errorResponse(res, 'Institutions cannot transition workflow stages.', 403, 'FORBIDDEN');
  }

  if (req.user.role === ROLES.AUDITOR) {
    return errorResponse(res, 'Auditor role is strictly read-only and cannot mutate workflow stages.', 403, 'FORBIDDEN');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  // 2. Institutional, Regional, and Assignment Scope checks
  if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
    if (app.region !== req.user.region) {
      return errorResponse(res, `Regional jurisdiction violation: Application belongs to region [${app.region}], user is assigned to [${req.user.region}].`, 403, 'FORBIDDEN');
    }
  }

  if (req.user.role === ROLES.SCRUTINY_OFFICER) {
    if (app.assigned_scrutiny_officer_id && app.assigned_scrutiny_officer_id !== req.user.id) {
      return errorResponse(res, 'Assignment violation: Scrutiny Officer is not assigned to evaluate this application.', 403, 'FORBIDDEN');
    }
  }

  if (req.user.role === ROLES.EVC_MEMBER) {
    if (app.assigned_evc_committee_id) {
      const isMember = db.prepare(`
        SELECT 1 FROM evc_committee_members WHERE committee_id = ? AND user_id = ?
      `).get(app.assigned_evc_committee_id, req.user.id);
      if (!isMember) {
        return errorResponse(res, 'Assignment violation: EVC Member is not assigned to this application committee.', 403, 'FORBIDDEN');
      }
    }
  }

  // 3. Hold check
  if (app.is_on_hold && toStage !== 'RESUMED') {
    return errorResponse(res, `Application is currently placed on statutory hold (${app.hold_reason}). Resume processing first.`, 409, 'APPLICATION_ON_HOLD');
  }

  const fromStage = (app.current_stage || app.status || 'SUBMITTED').trim();

  // 4. Same stage check
  if (fromStage === toStage) {
    return errorResponse(res, `Application is already at stage [${toStage}].`, 409, 'IDENTICAL_STAGE');
  }

  // 5. VALID_TRANSITIONS graph enforcement
  const allowedNext = VALID_TRANSITIONS[fromStage];
  if (!allowedNext || !allowedNext.includes(toStage)) {
    return errorResponse(
      res,
      `Invalid workflow transition: Transition from [${fromStage}] to [${toStage}] is not permitted by AICTE Approval Process Handbook (APH) regulations.`,
      409,
      'INVALID_WORKFLOW_TRANSITION'
    );
  }

  // 6. Role check for specific target stage
  const permittedRoles = STAGE_PERMITTED_ROLES[toStage];
  if (permittedRoles && !permittedRoles.includes(req.user.role)) {
    return errorResponse(
      res,
      `Insufficient permissions: Role [${req.user.role}] is not authorized to transition an application to [${toStage}].`,
      403,
      'STATUTORY_ROLE_UNAUTHORIZED'
    );
  }

  // 7. Statutory Authority Check for final decision
  if (toStage === 'APPROVED' || toStage === 'REJECTED') {
    if (req.user.role !== ROLES.COMPETENT_AUTHORITY) {
      return errorResponse(res, 'Statutory Privilege Violation: Approval or Rejection can only be executed by the authorized Competent Authority under Section 10(k) of the AICTE Act.', 403, 'STATUTORY_AUTHORITY_REQUIRED');
    }

    const openDef = db.prepare(`
      SELECT count(*) as count FROM deficiencies 
      WHERE application_id = ? AND status = 'OPEN' AND severity = 'CRITICAL'
    `).get(applicationId);

    if (openDef && openDef.count > 0) {
      return errorResponse(res, `Cannot finalize decision. Application has ${openDef.count} unresolved critical deficiencies.`, 400, 'UNRESOLVED_CRITICAL_DEFICIENCIES');
    }
  }

  // 8. Execute transition within a transaction with optimistic locking / concurrency check
  const historyId = 'wfh_' + uuidv4().slice(0, 10);
  let updated = false;

  const executeTransition = db.transaction(() => {
    const updateResult = db.prepare(`
      UPDATE applications SET
        current_stage = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND (current_stage = ? OR (current_stage IS NULL AND status = ?))
    `).run(toStage, toStage, applicationId, fromStage, fromStage);

    if (updateResult.changes > 0) {
      updated = true;
      db.prepare(`
        INSERT INTO application_workflow_history (
          id, application_id, from_stage, to_stage, transitioned_by, transitioned_by_role, remarks, prerequisites_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(historyId, applicationId, fromStage, toStage, req.user.id, req.user.role, remarks || `Transitioned to ${toStage}`);
    }
  });

  executeTransition();

  if (!updated) {
    return errorResponse(
      res,
      'Workflow transition conflict: Application state was modified concurrently by another process. Please reload and retry.',
      409,
      'TRANSITION_CONFLICT'
    );
  }

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

  const canHold = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.COMPETENT_AUTHORITY].includes(req.user.role);
  if (!canHold) {
    return errorResponse(res, 'User role not authorized to place applications on hold.', 403, 'FORBIDDEN');
  }

  if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region && app.region !== req.user.region) {
    return errorResponse(res, 'Regional jurisdiction violation: Cannot place application from another region on hold.', 403, 'FORBIDDEN');
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

  if (!applicationId) {
    return errorResponse(res, 'applicationId is required', 400, 'VALIDATION_ERROR');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  const canResume = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.REGULATION_BUREAU, ROLES.COMPETENT_AUTHORITY].includes(req.user.role);
  if (!canResume) {
    return errorResponse(res, 'User role not authorized to resume applications.', 403, 'FORBIDDEN');
  }

  if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region && app.region !== req.user.region) {
    return errorResponse(res, 'Regional jurisdiction violation: Cannot resume application from another region.', 403, 'FORBIDDEN');
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
 * Authorized handler for retrieving application workflow history
 * Enforces institution tenant isolation, regional boundaries, and role-based access.
 */
function handleHistory(req, res) {
  const applicationId = req.params.applicationId;
  if (!applicationId) {
    return errorResponse(res, 'applicationId is required', 400, 'VALIDATION_ERROR');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  // 1. Institution Isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    if (app.institution_id !== req.user.institution_id) {
      return errorResponse(res, 'Cross-institution access violation: Access to workflow history for another institution is forbidden.', 403, 'FORBIDDEN');
    }
  }

  // 2. Regional Directorate Jurisdiction
  if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
    if (app.region !== req.user.region) {
      return errorResponse(res, `Regional jurisdiction violation: Application belongs to region [${app.region}], user is assigned to [${req.user.region}].`, 403, 'FORBIDDEN');
    }
  }

  // 3. Scrutiny Assignment
  if (req.user.role === ROLES.SCRUTINY_OFFICER) {
    if (app.assigned_scrutiny_officer_id && app.assigned_scrutiny_officer_id !== req.user.id) {
      return errorResponse(res, 'Assignment violation: You are not assigned to evaluate this application docket.', 403, 'FORBIDDEN');
    }
  }

  // 4. EVC Member Assignment
  if (req.user.role === ROLES.EVC_MEMBER) {
    if (app.assigned_evc_committee_id) {
      const isMember = db.prepare(`
        SELECT 1 FROM evc_committee_members WHERE committee_id = ? AND user_id = ?
      `).get(app.assigned_evc_committee_id, req.user.id);
      if (!isMember) {
        return errorResponse(res, 'Assignment violation: You are not assigned to this application committee.', 403, 'FORBIDDEN');
      }
    }
  }

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
