const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * GET /api/scrutiny/evaluations/:applicationId
 * Get current scrutiny checklist & evaluation records
 */
router.get('/evaluations/:applicationId', authenticateToken, (req, res) => {
  const evaluation = db.prepare(`
    SELECT * FROM scrutiny_evaluations 
    WHERE application_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(req.params.applicationId);

  const deficiencies = db.prepare(`
    SELECT d.*, doc.title as document_title, doc.document_number
    FROM deficiencies d
    LEFT JOIN documents doc ON d.document_id = doc.id
    WHERE d.application_id = ?
    ORDER BY d.created_at DESC
  `).all(req.params.applicationId);

  let parsedChecklist = [];
  if (evaluation && evaluation.checklist_json) {
    try {
      parsedChecklist = JSON.parse(evaluation.checklist_json);
    } catch (e) {
      parsedChecklist = [];
    }
  }

  const result = {
    evaluation: evaluation ? {
      ...evaluation,
      checklist: parsedChecklist
    } : null,
    checklist: parsedChecklist,
    deficiencies
  };

  return successResponse(res, result, 'Scrutiny evaluation retrieved');
});

/**
 * POST /api/scrutiny/evaluations
 * Save or update scrutiny checklist items, overall remarks and recommendation
 */
router.post('/evaluations', authenticateToken, (req, res) => {
  const { applicationId, checklist, overallRemarks, recommendation, remarks, status = 'IN_PROGRESS' } = req.body;

  if (!applicationId) {
    return errorResponse(res, 'applicationId is required.', 400, 'VALIDATION_ERROR');
  }

  const canEvaluate = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.SCRUTINY_OFFICER].includes(req.user.role);
  if (!canEvaluate) {
    return errorResponse(res, 'Permission Denied: User role cannot evaluate scrutiny checklists.', 403, 'FORBIDDEN');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  // Scrutiny assignment check (Scrutiny officer must be assigned unless admin)
  if (req.user.role === ROLES.SCRUTINY_OFFICER && app.assigned_scrutiny_officer_id && app.assigned_scrutiny_officer_id !== req.user.id) {
    return errorResponse(res, `Assignment Violation: Scrutiny Officer ${req.user.full_name} is not assigned to application ${app.application_number}.`, 403, 'NOT_ASSIGNED');
  }

  const evalId = 'scrut_' + uuidv4().slice(0, 10);
  const checklistStr = checklist ? (typeof checklist === 'string' ? checklist : JSON.stringify(checklist)) : '[]';
  const finalRemarks = overallRemarks || remarks || '';
  const finalRec = recommendation || 'IN_REVIEW';

  db.prepare(`
    INSERT INTO scrutiny_evaluations (
      id, application_id, officer_id, officer_name, status, checklist_json, overall_remarks, recommendation, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${status === 'COMPLETED' ? 'CURRENT_TIMESTAMP' : 'NULL'})
  `).run(evalId, applicationId, req.user.id, req.user.full_name, status, checklistStr, finalRemarks, finalRec);

  if (status === 'COMPLETED') {
    db.prepare("UPDATE applications SET status = 'UNDER_EVC', current_stage = 'UNDER_EVC' WHERE id = ?").run(applicationId);
    createNotification({
      institutionId: app.institution_id,
      title: 'Scrutiny Evaluation Completed',
      message: `Scrutiny evaluation completed for ${app.application_number}. Recommendation: ${finalRec}`,
      type: 'SUCCESS',
      link: '/applications'
    });
  }

  return successResponse(res, { evaluationId: evalId }, 'Scrutiny evaluation findings recorded successfully.');
});

/**
 * POST /api/scrutiny/evaluations/:applicationId/item
 * Save or update single checklist item
 */
router.post('/evaluations/:applicationId/item', authenticateToken, (req, res) => {
  const { applicationId } = req.params;
  const { check_item_key, item_title, status = 'ACCEPTABLE', remarks = '' } = req.body;

  const canEvaluate = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.SCRUTINY_OFFICER].includes(req.user.role);
  if (!canEvaluate) {
    return errorResponse(res, 'User role cannot evaluate scrutiny checklists.', 403, 'FORBIDDEN');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  // Get or initialize evaluation
  let currentEval = db.prepare('SELECT * FROM scrutiny_evaluations WHERE application_id = ? ORDER BY created_at DESC LIMIT 1').get(applicationId);
  let checklist = [];

  if (currentEval && currentEval.checklist_json) {
    try {
      checklist = JSON.parse(currentEval.checklist_json);
    } catch (e) {
      checklist = [];
    }
  }

  // Update or insert item
  const existingIdx = checklist.findIndex(c => c.check_item_key === check_item_key);
  const updatedItem = {
    check_item_key,
    title: item_title || check_item_key,
    status,
    remarks,
    verified_at: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    checklist[existingIdx] = { ...checklist[existingIdx], ...updatedItem };
  } else {
    checklist.push(updatedItem);
  }

  const checklistStr = JSON.stringify(checklist);

  if (currentEval) {
    db.prepare('UPDATE scrutiny_evaluations SET checklist_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(checklistStr, currentEval.id);
  } else {
    const evalId = 'scrut_' + uuidv4().slice(0, 10);
    db.prepare(`
      INSERT INTO scrutiny_evaluations (id, application_id, officer_id, officer_name, status, checklist_json, recommendation)
      VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?, 'IN_REVIEW')
    `).run(evalId, applicationId, req.user.id, req.user.full_name, checklistStr);
  }

  return successResponse(res, { checklist }, 'Checklist item evaluated successfully.');
});

/**
 * POST /api/scrutiny/evaluations/:applicationId/complete
 * Mark scrutiny evaluation completed
 */
router.post('/evaluations/:applicationId/complete', authenticateToken, (req, res) => {
  const { applicationId } = req.params;
  const { overall_recommendation, recommendation, remarks = '' } = req.body;
  const finalRec = overall_recommendation || recommendation || 'RECOMMENDED_FOR_EVC';

  const canEvaluate = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.SCRUTINY_OFFICER].includes(req.user.role);
  if (!canEvaluate) {
    return errorResponse(res, 'User role cannot finalize scrutiny evaluation.', 403, 'FORBIDDEN');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  let currentEval = db.prepare('SELECT * FROM scrutiny_evaluations WHERE application_id = ? ORDER BY created_at DESC LIMIT 1').get(applicationId);

  if (currentEval) {
    db.prepare(`
      UPDATE scrutiny_evaluations SET
        status = 'COMPLETED',
        recommendation = ?,
        overall_remarks = ?,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(finalRec, remarks, currentEval.id);
  } else {
    const evalId = 'scrut_' + uuidv4().slice(0, 10);
    db.prepare(`
      INSERT INTO scrutiny_evaluations (id, application_id, officer_id, officer_name, status, recommendation, overall_remarks, completed_at)
      VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, CURRENT_TIMESTAMP)
    `).run(evalId, applicationId, req.user.id, req.user.full_name, finalRec, remarks);
  }

  // Update application stage if recommended
  if (finalRec === 'RECOMMENDED_FOR_EVC') {
    db.prepare("UPDATE applications SET status = 'UNDER_EVC', current_stage = 'UNDER_EVC' WHERE id = ?").run(applicationId);
  } else if (finalRec === 'DEFICIENCIES_COMMUNICATED') {
    db.prepare("UPDATE applications SET status = 'SCRUTINY_DEFICIENT', current_stage = 'SCRUTINY_DEFICIENT' WHERE id = ?").run(applicationId);
  }

  return successResponse(res, { recommendation: finalRec }, 'Scrutiny evaluation completed and signed by Scrutiny Committee.');
});

/**
 * GET /api/scrutiny/deficiencies/:applicationId
 */
router.get('/deficiencies/:applicationId', authenticateToken, (req, res) => {
  const deficiencies = db.prepare(`
    SELECT d.*, doc.title as document_title 
    FROM deficiencies d
    LEFT JOIN documents doc ON d.document_id = doc.id
    WHERE d.application_id = ?
    ORDER BY d.created_at DESC
  `).all(req.params.applicationId);

  return successResponse(res, deficiencies, 'Deficiencies retrieved successfully');
});

/**
 * POST /api/scrutiny/deficiencies
 * Issue new deficiency notice
 */
router.post('/deficiencies', authenticateToken, (req, res) => {
  const { 
    applicationId, 
    documentId, 
    title, 
    deficiencyType, 
    description, 
    statutoryClause, 
    remedyInstructions, 
    deadlineDays, 
    severity = 'MAJOR' 
  } = req.body;

  const defTitle = title || deficiencyType;
  if (!applicationId || !defTitle || !description) {
    return errorResponse(res, 'applicationId, title (or deficiencyType), and description required.', 400, 'VALIDATION_ERROR');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  const defId = 'def_' + uuidv4().slice(0, 10);
  const defClause = statutoryClause || 'APH 2026-27';
  const defRemedy = remedyInstructions || '';
  const defDays = deadlineDays ? Number(deadlineDays) : 14;

  db.prepare(`
    INSERT INTO deficiencies (
      id, application_id, document_id, raised_by_id, raised_by_name, raised_by_role,
      title, description, severity, status, statutory_clause, remedy_instructions, deadline_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)
  `).run(
    defId, 
    applicationId, 
    documentId || null, 
    req.user.id, 
    req.user.full_name, 
    req.user.role, 
    defTitle, 
    description, 
    severity,
    defClause,
    defRemedy,
    defDays
  );

  // Mark application as SCRUTINY_DEFICIENT
  db.prepare("UPDATE applications SET status = 'SCRUTINY_DEFICIENT', current_stage = 'SCRUTINY_DEFICIENT' WHERE id = ?").run(applicationId);

  createNotification({
    institutionId: app.institution_id,
    title: `Scrutiny Deficiency Raised: ${defTitle}`,
    message: `A ${severity} deficiency has been raised for ${app.application_number}: ${description}. Statutory deadline: ${defDays} days.`,
    type: 'DEFICIENCY',
    link: '/scrutiny'
  });

  return successResponse(res, { id: defId, deficiencyId: defId }, 'Formal statutory deficiency notice issued to institution.', 201);
});

/**
 * POST /api/scrutiny/deficiencies/:id/respond
 * Institution responds with clarification and optional evidence document
 */
router.post('/deficiencies/:id/respond', authenticateToken, (req, res) => {
  const responseText = req.body.responseText || req.body.institutionResponse;
  const responseDocumentId = req.body.responseDocumentId || req.body.documentId;

  if (!responseText) {
    return errorResponse(res, 'Response clarification text required.', 400, 'VALIDATION_ERROR');
  }

  const def = db.prepare('SELECT * FROM deficiencies WHERE id = ?').get(req.params.id);
  if (!def) {
    return errorResponse(res, 'Deficiency not found', 404, 'NOT_FOUND');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(def.application_id);

  // Tenant isolation: Only users from the target institution or admin can respond
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    if (app && app.institution_id !== req.user.institution_id) {
      return errorResponse(res, 'Cross-tenant violation: Cannot respond to another institution deficiency.', 403, 'FORBIDDEN');
    }
  }

  db.prepare(`
    UPDATE deficiencies SET
      institution_response = ?,
      response_document_id = COALESCE(?, response_document_id),
      status = 'RESPONDED'
    WHERE id = ?
  `).run(responseText, responseDocumentId || null, def.id);

  createNotification({
    roleTarget: ROLES.SCRUTINY_OFFICER,
    title: 'Institution Responded to Deficiency',
    message: `Institution responded to deficiency "${def.title}" on application ${app ? app.application_number : ''}.`,
    type: 'INFO',
    link: '/scrutiny'
  });

  return successResponse(res, { deficiencyId: def.id, status: 'RESPONDED' }, 'Response submitted for officer re-scrutiny.');
});

/**
 * POST /api/scrutiny/deficiencies/:id/resolve
 * Officer formally resolves or waives a deficiency
 */
router.post('/deficiencies/:id/resolve', authenticateToken, (req, res) => {
  const resolutionStatus = req.body.resolutionStatus || req.body.status || 'RESOLVED';
  const remarks = req.body.remarks || req.body.resolutionRemarks || '';

  const canResolve = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.SCRUTINY_OFFICER].includes(req.user.role);
  if (!canResolve) {
    return errorResponse(res, 'User role not authorized to resolve deficiencies.', 403, 'FORBIDDEN');
  }

  const def = db.prepare('SELECT * FROM deficiencies WHERE id = ?').get(req.params.id);
  if (!def) {
    return errorResponse(res, 'Deficiency not found', 404, 'NOT_FOUND');
  }

  db.prepare(`
    UPDATE deficiencies SET
      status = ?,
      resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(resolutionStatus, def.id);

  return successResponse(res, { deficiencyId: def.id, status: resolutionStatus }, `Deficiency status updated to [${resolutionStatus}].`);
});

module.exports = router;
