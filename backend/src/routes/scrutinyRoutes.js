const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');

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

  return res.json({
    evaluation: evaluation ? {
      ...evaluation,
      checklist: JSON.parse(evaluation.checklist_json)
    } : null,
    deficiencies
  });
});

/**
 * POST /api/scrutiny/evaluations
 * Save or update scrutiny checklist items, overall remarks and recommendation
 */
router.post('/evaluations', authenticateToken, (req, res) => {
  const { applicationId, checklist, overallRemarks, recommendation, status = 'IN_PROGRESS' } = req.body;

  if (!applicationId || !checklist) {
    return res.status(400).json({ error: 'applicationId and checklist are required.' });
  }

  // Scrutiny Officers, Regional Officers, Admins can evaluate
  const canEvaluate = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.SCRUTINY_OFFICER].includes(req.user.role);
  if (!canEvaluate) {
    return res.status(403).json({ error: 'Permission Denied: User role cannot evaluate scrutiny checklists.' });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const evalId = 'scrut_' + uuidv4().slice(0, 10);
  const checklistStr = typeof checklist === 'string' ? checklist : JSON.stringify(checklist);

  db.prepare(`
    INSERT INTO scrutiny_evaluations (
      id, application_id, officer_id, officer_name, status, checklist_json, overall_remarks, recommendation, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${status === 'COMPLETED' ? 'CURRENT_TIMESTAMP' : 'NULL'})
  `).run(evalId, applicationId, req.user.id, req.user.full_name, status, checklistStr, overallRemarks || '', recommendation || 'IN_REVIEW');

  // Update application stage if completed or deficient
  if (status === 'COMPLETED') {
    db.prepare("UPDATE applications SET status = 'UNDER_EVC', current_stage = 'UNDER_EVC' WHERE id = ?").run(applicationId);
    createNotification({
      institutionId: app.institution_id,
      title: 'Scrutiny Evaluation Completed',
      message: `Scrutiny evaluation completed for ${app.application_number}. Forwarded for Expert Visiting Committee inspection.`,
      type: 'SUCCESS',
      link: '/applications'
    });
  } else if (recommendation === 'DEFICIENCY_RAISED') {
    db.prepare("UPDATE applications SET status = 'SCRUTINY_DEFICIENT', current_stage = 'SCRUTINY_DEFICIENT' WHERE id = ?").run(applicationId);
  }

  return res.json({
    success: true,
    message: 'Scrutiny checklist & evaluation findings recorded successfully.',
    evaluationId: evalId
  });
});

/**
 * GET /api/scrutiny/deficiencies/:applicationId
 * List all open and resolved deficiencies
 */
router.get('/deficiencies/:applicationId', authenticateToken, (req, res) => {
  const deficiencies = db.prepare(`
    SELECT d.*, doc.title as document_title 
    FROM deficiencies d
    LEFT JOIN documents doc ON d.document_id = doc.id
    WHERE d.application_id = ?
    ORDER BY d.created_at DESC
  `).all(req.params.applicationId);

  return res.json({ deficiencies });
});

/**
 * POST /api/scrutiny/deficiencies
 * Scrutiny Officer raises a new formal deficiency notice
 */
router.post('/deficiencies', authenticateToken, (req, res) => {
  const { applicationId, documentId, title, description, severity = 'MAJOR' } = req.body;

  if (!applicationId || !title || !description) {
    return res.status(400).json({ error: 'applicationId, title, and description required.' });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const defId = 'def_' + uuidv4().slice(0, 10);
  db.prepare(`
    INSERT INTO deficiencies (
      id, application_id, document_id, raised_by_id, raised_by_name, raised_by_role,
      title, description, severity, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
  `).run(defId, applicationId, documentId || null, req.user.id, req.user.full_name, req.user.role, title, description, severity);

  // Mark application as SCRUTINY_DEFICIENT
  db.prepare("UPDATE applications SET status = 'SCRUTINY_DEFICIENT', current_stage = 'SCRUTINY_DEFICIENT' WHERE id = ?").run(applicationId);

  // Send High Priority Notification to Institution
  createNotification({
    institutionId: app.institution_id,
    title: `Scrutiny Deficiency Raised: ${title}`,
    message: `A ${severity} deficiency has been raised for ${app.application_number}: ${description}. Please review and upload corrective evidence.`,
    type: 'DEFICIENCY',
    link: '/applications'
  });

  return res.status(201).json({
    success: true,
    message: 'Formal statutory deficiency notice issued to institution.',
    deficiencyId: defId
  });
});

/**
 * POST /api/scrutiny/deficiencies/:id/respond
 * Institution responds with clarification and optional evidence document
 */
router.post('/deficiencies/:id/respond', authenticateToken, (req, res) => {
  const { responseText, responseDocumentId } = req.body;

  if (!responseText) {
    return res.status(400).json({ error: 'Response clarification text required.' });
  }

  const def = db.prepare('SELECT * FROM deficiencies WHERE id = ?').get(req.params.id);
  if (!def) {
    return res.status(404).json({ error: 'Deficiency not found' });
  }

  db.prepare(`
    UPDATE deficiencies SET
      institution_response = ?,
      response_document_id = COALESCE(?, response_document_id),
      status = 'PENDING_VERIFICATION'
    WHERE id = ?
  `).run(responseText, responseDocumentId || null, def.id);

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(def.application_id);

  createNotification({
    roleTarget: ROLES.SCRUTINY_OFFICER,
    title: 'Institution Responded to Deficiency',
    message: `Institution responded to deficiency "${def.title}" on application ${app ? app.application_number : ''}.`,
    type: 'INFO',
    link: '/scrutiny'
  });

  return res.json({ success: true, message: 'Response submitted for officer re-scrutiny.' });
});

/**
 * POST /api/scrutiny/deficiencies/:id/resolve
 * Officer formally resolves or waives a deficiency
 */
router.post('/deficiencies/:id/resolve', authenticateToken, (req, res) => {
  const { resolutionStatus = 'RESOLVED', remarks } = req.body;

  const def = db.prepare('SELECT * FROM deficiencies WHERE id = ?').get(req.params.id);
  if (!def) {
    return res.status(404).json({ error: 'Deficiency not found' });
  }

  db.prepare(`
    UPDATE deficiencies SET
      status = ?,
      resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(resolutionStatus, def.id);

  return res.json({
    success: true,
    message: `Deficiency status updated to [${resolutionStatus}].`
  });
});

module.exports = router;
