const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Valid Statutory Decision Enums
 */
const VALID_DECISIONS = [
  'APPROVED',
  'REJECTED',
  'RETURNED_WITH_CONDITIONS',
  'REJECTED_WITH_APPEAL'
];

/**
 * Authorized Decision-Making / Oversight Roles for pending dockets
 */
const AUTHORIZED_DECISION_ROLES = [
  ROLES.COMPETENT_AUTHORITY,
  ROLES.REGULATION_BUREAU,
  ROLES.BUREAU_OFFICER,
  ROLES.REGIONAL_OFFICER,
  ROLES.SUPER_ADMIN,
  ROLES.AICTE_ADMIN
];

/**
 * Allocates a controlled, deterministic order number using an atomic database sequence
 * Prevents race conditions and duplicate order numbers across concurrent processes.
 */
function allocateOrderNumber(customOrderNumber = null) {
  if (customOrderNumber && typeof customOrderNumber === 'string' && customOrderNumber.trim()) {
    const cleanNumber = customOrderNumber.trim();
    const existing = db.prepare(`
      SELECT id FROM authority_decisions 
      WHERE order_number = ? OR formal_order_number = ?
    `).get(cleanNumber, cleanNumber);

    if (existing) {
      throw new Error(`Order number [${cleanNumber}] is already assigned to another statutory decision.`);
    }
    return cleanNumber;
  }

  const year = new Date().getFullYear();
  const allocateTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO order_number_sequences (year, current_val)
      VALUES (?, 1)
      ON CONFLICT(year) DO UPDATE SET current_val = current_val + 1
    `).run(year);

    const seqRow = db.prepare('SELECT current_val FROM order_number_sequences WHERE year = ?').get(year);
    return `AICTE/ORDER/${year}/${String(seqRow.current_val).padStart(6, '0')}`;
  });

  return allocateTx();
}

/**
 * Centralized Decision Prerequisite Validation Function
 * Evaluates application stage, document status, deficiencies, scrutiny/EVC/SAC records,
 * and duplicate decision safeguards.
 */
function validateDecisionPrerequisites(applicationId, requestedDecision = null) {
  const errors = [];
  const warnings = [];

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return {
      isValid: false,
      errors: ['Application does not exist.'],
      prerequisites: null
    };
  }

  // 1. Duplicate Decision Check
  const existingDecision = db.prepare(`
    SELECT * FROM authority_decisions 
    WHERE application_id = ? AND decision IN ('APPROVED', 'REJECTED')
  `).get(applicationId);

  const hasExistingFinalDecision = !!existingDecision;
  if (hasExistingFinalDecision) {
    errors.push(`A final statutory decision [${existingDecision.decision}] has already been executed for this application under Order ${existingDecision.order_number}. Duplicate final decisions are prohibited.`);
  }

  // 2. Workflow Stage Eligibility
  const currentStage = app.current_stage || app.status || 'SUBMITTED';
  const invalidStagesForFinalDecision = ['DRAFT', 'SUBMITTED'];
  if (invalidStagesForFinalDecision.includes(currentStage)) {
    errors.push(`Application is currently at stage [${currentStage}]. Statutory evaluation and scrutiny must be completed before rendering a final decision.`);
  }

  // 3. Outstanding Deficiencies
  const openCriticalDef = db.prepare(`
    SELECT count(*) as count FROM deficiencies 
    WHERE application_id = ? AND status = 'OPEN' AND severity = 'CRITICAL'
  `).get(applicationId).count;

  const openMajorDef = db.prepare(`
    SELECT count(*) as count FROM deficiencies 
    WHERE application_id = ? AND status = 'OPEN' AND severity = 'MAJOR'
  `).get(applicationId).count;

  if (openCriticalDef > 0) {
    errors.push(`Cannot issue statutory decision: ${openCriticalDef} critical deficiencies remain unresolved.`);
  }
  if (openMajorDef > 0 && requestedDecision === 'APPROVED') {
    errors.push(`Cannot grant statutory approval: ${openMajorDef} major deficiencies remain unresolved.`);
  }

  // 4. Scrutiny Evaluation Check
  const scrutiny = db.prepare(`
    SELECT * FROM scrutiny_evaluations 
    WHERE application_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(applicationId);

  const scrutinyCompleted = scrutiny ? (scrutiny.status === 'COMPLETED' || scrutiny.recommendation === 'APPROVE_FOR_NEXT' || scrutiny.recommendation === 'EVC_RECOMMENDED' || scrutiny.recommendation === 'RECOMMENDED_FOR_EVC') : false;
  if (!scrutinyCompleted && currentStage !== 'APPROVED' && currentStage !== 'REJECTED') {
    warnings.push('Formal Scrutiny Evaluation record is pending or incomplete.');
  }

  // If scrutiny recommended rejection, verify if SAC hearing reversed it
  const sac = db.prepare(`
    SELECT * FROM sac_hearings 
    WHERE application_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(applicationId);

  if (scrutiny && scrutiny.recommendation === 'REJECT_RECOMMENDED' && requestedDecision === 'APPROVED') {
    const sacApproved = sac && sac.recommendation === 'APPROVE_GRANT';
    if (!sacApproved) {
      errors.push('Scrutiny Committee recommended rejection, and no Standing Appellate Committee (SAC) grant has reversed the recommendation.');
    }
  }

  // 5. Document Verification Check (for APPROVAL)
  let unverifiedDocsCount = 0;
  if (requestedDecision === 'APPROVED') {
    unverifiedDocsCount = db.prepare(`
      SELECT count(*) as count FROM documents 
      WHERE application_id = ? AND (verification_status IS NULL OR verification_status != 'VERIFIED')
    `).get(applicationId).count;

    if (unverifiedDocsCount > 0) {
      warnings.push(`${unverifiedDocsCount} uploaded statutory documents have not yet been marked as VERIFIED.`);
    }
  }

  const evc = db.prepare(`
    SELECT * FROM evc_inspections 
    WHERE application_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(applicationId);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    prerequisites: {
      hasExistingFinalDecision,
      currentStage,
      scrutinyCompleted,
      evcCompleted: evc ? (evc.status === 'COMPLETED' || evc.outcome === 'RECOMMENDED') : false,
      sacReviewed: sac ? (sac.status === 'COMPLETED' || sac.status === 'CONCLUDED') : true,
      openCriticalDeficiencies: openCriticalDef,
      openMajorDeficiencies: openMajorDef,
      unverifiedDocsCount
    }
  };
}

/**
 * GET /api/decisions/pending
 * List applications awaiting statutory consideration
 * Enforces strict role-based and jurisdiction-based scope filtering.
 */
router.get('/pending', authenticateToken, (req, res) => {
  // 1. Role Authorization
  if (!AUTHORIZED_DECISION_ROLES.includes(req.user.role)) {
    return errorResponse(res, 'Access Denied: Your role is not authorized to access pending statutory decision dockets.', 403, 'FORBIDDEN');
  }

  let query = `
    SELECT a.*, i.name as institution_name, i.region, i.aicte_id
    FROM applications a
    JOIN institutions i ON a.institution_id = i.id
    WHERE a.status NOT IN ('APPROVED', 'REJECTED')
  `;
  const params = [];

  // 2. Regional Directorate Scope Restriction
  if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
    query += ` AND a.region = ?`;
    params.push(req.user.region);
  }

  query += ` ORDER BY a.created_at DESC`;

  const pendingApps = db.prepare(query).all(...params);
  return successResponse(res, { pendingApplications: pendingApps }, 'Pending decision cases retrieved');
});

/**
 * GET /api/decisions/:applicationId or /api/decisions/application/:applicationId
 * Enforces institution tenant isolation and regional jurisdiction before returning decision docket.
 */
function handleGetDecision(req, res) {
  const applicationId = req.params.applicationId;
  if (!applicationId) {
    return errorResponse(res, 'applicationId is required', 400, 'VALIDATION_ERROR');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  // 1. Institutional Tenant Isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    if (app.institution_id !== req.user.institution_id) {
      return errorResponse(res, 'Access Denied: Cross-institution data isolation violation.', 403, 'FORBIDDEN');
    }
  }

  // 2. Regional Directorate Jurisdiction
  if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
    if (app.region !== req.user.region) {
      return errorResponse(res, `Regional jurisdiction violation: Application belongs to region [${app.region}], user is assigned to [${req.user.region}].`, 403, 'FORBIDDEN');
    }
  }

  const decision = db.prepare(`
    SELECT * FROM authority_decisions 
    WHERE application_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(applicationId);

  const prereqValidation = validateDecisionPrerequisites(applicationId, null);

  const payload = decision || {
    application_id: applicationId,
    decision: null,
    prerequisites: {
      ...prereqValidation.prerequisites,
      canExecuteDecision: (req.user.role === ROLES.COMPETENT_AUTHORITY) && prereqValidation.isValid
    },
    prerequisiteErrors: prereqValidation.errors,
    prerequisiteWarnings: prereqValidation.warnings
  };

  return successResponse(res, payload, 'Decision details retrieved');
}

router.get('/application/:applicationId', authenticateToken, handleGetDecision);
router.get('/:applicationId', authenticateToken, handleGetDecision);

/**
 * Common handler for executing decision: /render and /execute
 * Enforces strict enum validation, mandatory non-default fields, prerequisite checks,
 * atomic order number sequencing, and database transactions.
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

  // 1. Strict Decision Enum Validation
  const normalizedDecision = decision.trim().toUpperCase();
  if (!VALID_DECISIONS.includes(normalizedDecision)) {
    return errorResponse(
      res,
      `Invalid decision value [${decision}]. Permitted statutory decisions are: ${VALID_DECISIONS.join(', ')}.`,
      400,
      'INVALID_DECISION_ENUM'
    );
  }

  // 2. Statutory Authority Separation
  if (req.user.role !== ROLES.COMPETENT_AUTHORITY) {
    return errorResponse(
      res,
      'Statutory Privilege Violation: Decision approval or rejection is strictly reserved for the authorized Competent Authority under Section 10(k) of the AICTE Act.',
      403,
      'FORBIDDEN'
    );
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  // 3. Centralized Prerequisite Validation
  const prereqValidation = validateDecisionPrerequisites(applicationId, normalizedDecision);
  if (!prereqValidation.isValid) {
    return errorResponse(
      res,
      prereqValidation.errors[0] || 'Prerequisites for issuing this statutory decision are unmet.',
      400,
      'UNMET_STATUTORY_PREREQUISITES',
      { unmetConditions: prereqValidation.errors }
    );
  }

  // 4. Validate Mandatory Fields (NO UNSAFE DEFAULTS)
  let finalIntake = 0;
  let finalYears = 0;

  if (normalizedDecision === 'APPROVED') {
    if (approvedIntake === undefined || approvedIntake === null || approvedIntake === '') {
      return errorResponse(
        res,
        'approvedIntake is mandatory for approval orders and must be explicitly specified.',
        400,
        'MISSING_MANDATORY_FIELD'
      );
    }
    finalIntake = Number(approvedIntake);
    if (!Number.isInteger(finalIntake) || finalIntake <= 0 || finalIntake > 5000) {
      return errorResponse(
        res,
        'approvedIntake must be an explicitly specified positive integer (seats).',
        400,
        'INVALID_INTAKE_VALUE'
      );
    }

    if (validityYears === undefined || validityYears === null || validityYears === '') {
      return errorResponse(
        res,
        'validityYears is mandatory for approval orders and must be explicitly specified.',
        400,
        'MISSING_MANDATORY_FIELD'
      );
    }
    finalYears = Number(validityYears);
    if (!Number.isInteger(finalYears) || finalYears < 1 || finalYears > 5) {
      return errorResponse(
        res,
        'validityYears must be an integer between 1 and 5 years.',
        400,
        'INVALID_VALIDITY_YEARS'
      );
    }
  } else if (normalizedDecision === 'REJECTED') {
    if (!reasoning && !remarks) {
      return errorResponse(
        res,
        'Statutory reasoning is mandatory when issuing a formal rejection order.',
        400,
        'MISSING_MANDATORY_FIELD'
      );
    }
  }

  // 5. Deterministic Order Number Allocation
  let orderNumber;
  try {
    orderNumber = allocateOrderNumber(formalOrderNumber);
  } catch (err) {
    return errorResponse(res, err.message, 409, 'ORDER_NUMBER_CONFLICT');
  }

  const decisionId = 'dec_' + uuidv4().slice(0, 10);
  const finalReasoning = (reasoning || remarks || (normalizedDecision === 'APPROVED' ? 'Approved as per AICTE Approval Process Handbook (APH) norms.' : 'Statutory rejection order.')).trim();

  // 6. Execute Decision within Database Transaction
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
      normalizedDecision,
      orderNumber,
      orderNumber,
      finalIntake,
      finalYears,
      finalReasoning,
      conditions || ''
    );

    db.prepare(`
      UPDATE applications SET
        status = ?,
        current_stage = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(normalizedDecision, normalizedDecision, applicationId);

    // Record workflow history entry
    db.prepare(`
      INSERT INTO application_workflow_history (
        id, application_id, from_stage, to_stage, transitioned_by, transitioned_by_role, remarks, prerequisites_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      'wfh_' + uuidv4().slice(0, 10),
      applicationId,
      app.current_stage || 'PENDING_DECISION',
      normalizedDecision,
      req.user.id,
      req.user.role,
      `Statutory decision [${normalizedDecision}] executed under Order ${orderNumber}`
    );
  });

  executeDecisionTx();

  createNotification({
    institutionId: app.institution_id,
    title: `Statutory Decision Issued: ${normalizedDecision}`,
    message: `Competent Authority has rendered a decision of [${normalizedDecision}] for application ${app.application_number}. Formal Order: ${orderNumber}.`,
    type: normalizedDecision === 'APPROVED' ? 'SUCCESS' : 'WARNING',
    link: '/decisions'
  });

  return successResponse(res, {
    decisionId,
    decision: normalizedDecision,
    formalOrderNumber: orderNumber,
    approvedIntake: finalIntake,
    validityYears: finalYears,
    reasoning: finalReasoning,
    applicationId
  }, `Formal Statutory Order [${normalizedDecision}] issued successfully.`, 201);
}

router.post('/render', authenticateToken, handleExecuteDecision);
router.post('/execute', authenticateToken, handleExecuteDecision);

module.exports = router;
