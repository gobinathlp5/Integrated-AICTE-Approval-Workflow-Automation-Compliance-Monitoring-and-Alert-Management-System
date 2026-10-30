const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');
const { recordDocumentAudit } = require('../audit');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * GET /api/decisions/pending
 * List applications awaiting statutory consideration
 */
router.get('/pending', authenticateToken, (req, res) => {
  const pendingApps = db.prepare(`
    SELECT a.*, i.name as institution_name, i.region, i.aicte_id
    FROM applications a
    JOIN institutions i ON a.institution_id = i.id
    WHERE a.status NOT IN ('APPROVED', 'REJECTED')
    ORDER BY a.created_at DESC
  `).all();

  return successResponse(res, { pendingApplications: pendingApps }, 'Pending decision cases retrieved');
});

/**
 * GET /api/decisions/:applicationId or /api/decisions/application/:applicationId
 */
function handleGetDecision(req, res) {
  const applicationId = req.params.applicationId;
  const decision = db.prepare(`
    SELECT * FROM authority_decisions 
    WHERE application_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(applicationId);

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  const openDeficiencies = db.prepare(`
    SELECT count(*) as count FROM deficiencies 
    WHERE application_id = ? AND status = 'OPEN'
  `).get(app.id).count;

  const scrutiny = db.prepare(`
    SELECT status, recommendation FROM scrutiny_evaluations 
    WHERE application_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(app.id);

  const evc = db.prepare(`
    SELECT status, outcome, recommendation FROM evc_inspections 
    WHERE application_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(app.id);

  const sac = db.prepare(`
    SELECT status, recommendation FROM sac_hearings 
    WHERE application_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(app.id);

  const prerequisites = {
    scrutinyCompleted: scrutiny ? (scrutiny.status === 'COMPLETED' || scrutiny.recommendation === 'APPROVE_FOR_NEXT' || scrutiny.recommendation === 'RECOMMENDED_FOR_EVC') : false,
    evcCompleted: evc ? (evc.status === 'COMPLETED' || evc.outcome === 'RECOMMENDED') : (app.status === 'UNDER_SAC' || app.status === 'APPROVED'),
    sacReviewed: sac ? sac.status === 'COMPLETED' || sac.status === 'CONCLUDED' : true,
    noOpenDeficiencies: openDeficiencies === 0,
    openDeficienciesCount: openDeficiencies,
    canExecuteDecision: (req.user.role === ROLES.COMPETENT_AUTHORITY) && (openDeficiencies === 0)
  };

  const payload = decision || {
    application_id: applicationId,
    decision: null,
    prerequisites
  };

  return successResponse(res, payload, 'Decision details retrieved');
}

router.get('/application/:applicationId', authenticateToken, handleGetDecision);
router.get('/:applicationId', authenticateToken, handleGetDecision);

/**
 * Common handler for executing decision: /render and /execute
 */
function handleExecuteDecision(req, res) {
  const { 
    applicationId, 
    decision, 
    formalOrderNumber, 
    approvedIntake, 
    validityYears, 
    reasoning, 
    remarks, 
    conditions 
  } = req.body;

  if (!applicationId || !decision) {
    return errorResponse(res, 'applicationId and decision are required.', 400, 'VALIDATION_ERROR');
  }

  // Statutory Authority Separation:
  // Decision approval / rejection is strictly reserved for COMPETENT_AUTHORITY.
  // Super Admin / Platform Admin alone cannot execute statutory orders without this designated role.
  if (req.user.role !== ROLES.COMPETENT_AUTHORITY) {
    return errorResponse(res, 'Statutory Privilege Violation: Decision approval / rejection is strictly reserved for the authorized Competent Authority under Section 10(k) of the AICTE Act.', 403, 'FORBIDDEN');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  // Validate no unresolved critical deficiencies
  const openDef = db.prepare(`
    SELECT count(*) as count FROM deficiencies 
    WHERE application_id = ? AND status = 'OPEN' AND severity = 'CRITICAL'
  `).get(applicationId);

  if (openDef && openDef.count > 0) {
    return errorResponse(res, `Cannot issue statutory decision while ${openDef.count} critical deficiencies remain open.`, 400, 'UNRESOLVED_CRITICAL_DEFICIENCIES');
  }

  const decisionId = 'dec_' + uuidv4().slice(0, 10);
  const orderNumber = formalOrderNumber || `AICTE/ORDER/${new Date().getFullYear()}/${Math.floor(100000 + Math.random() * 900000)}`;
  const finalReasoning = reasoning || remarks || 'Approved as per AICTE Approval Process Handbook (APH) 2026-27 norms.';
  const finalIntake = approvedIntake ? Number(approvedIntake) : 180;
  const finalYears = validityYears ? Number(validityYears) : 3;

  // Execute within a transaction
  const executeDecisionTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO authority_decisions (
        id, application_id, decision_maker_id, decision_maker_name,
        authority_user_id, authority_name, authority_role,
        decision, order_number, formal_order_number,
        approved_intake, validity_years, reasoning, conditions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decisionId,
      applicationId,
      req.user.id,
      req.user.full_name,
      req.user.id,
      req.user.full_name,
      req.user.role,
      decision,
      orderNumber,
      orderNumber,
      decision === 'REJECTED' ? 0 : finalIntake,
      decision === 'REJECTED' ? 0 : finalYears,
      finalReasoning,
      conditions || ''
    );

    db.prepare(`
      UPDATE applications SET
        status = ?,
        current_stage = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(decision, decision, applicationId);
  });

  executeDecisionTx();

  createNotification({
    institutionId: app.institution_id,
    title: `Statutory Decision Issued: ${decision}`,
    message: `Competent Authority has rendered a decision of [${decision}] for application ${app.application_number}. Formal Order: ${orderNumber}.`,
    type: decision === 'APPROVED' ? 'SUCCESS' : 'WARNING',
    link: '/decisions'
  });

  return successResponse(res, {
    decisionId,
    decision,
    formalOrderNumber: orderNumber,
    approvedIntake: finalIntake,
    validityYears: finalYears,
    reasoning: finalReasoning,
    applicationId
  }, `Formal Statutory Order [${decision}] issued successfully.`, 201);
}

router.post('/render', authenticateToken, handleExecuteDecision);
router.post('/execute', authenticateToken, handleExecuteDecision);

module.exports = router;
