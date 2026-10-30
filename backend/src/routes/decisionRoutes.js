const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');
const { recordDocumentAudit } = require('../audit');

/**
 * GET /api/decisions/:applicationId
 * Get decision history & verification prerequisites for an application
 */
router.get('/:applicationId', authenticateToken, (req, res) => {
  const decision = db.prepare(`
    SELECT * FROM authority_decisions 
    WHERE application_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(req.params.applicationId);

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.applicationId);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Evaluate prerequisites checklist
  const openDeficiencies = db.prepare(`
    SELECT count(*) as count FROM deficiencies 
    WHERE application_id = ? AND status = 'OPEN'
  `).get(app.id).count;

  const scrutiny = db.prepare(`
    SELECT status, recommendation FROM scrutiny_evaluations 
    WHERE application_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(app.id);

  const evc = db.prepare(`
    SELECT status, recommendation FROM evc_inspections 
    WHERE application_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(app.id);

  const sac = db.prepare(`
    SELECT status, recommendation FROM sac_hearings 
    WHERE application_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(app.id);

  const prerequisites = {
    scrutinyCompleted: scrutiny ? (scrutiny.status === 'COMPLETED' || scrutiny.recommendation === 'APPROVE_FOR_NEXT') : false,
    evcCompleted: evc ? (evc.status === 'COMPLETED') : (app.status === 'UNDER_SAC' || app.status === 'APPROVED'),
    sacReviewed: sac ? sac.status === 'COMPLETED' : true,
    noOpenDeficiencies: openDeficiencies === 0,
    openDeficienciesCount: openDeficiencies,
    canExecuteDecision: (req.user.role === ROLES.COMPETENT_AUTHORITY || req.user.role === ROLES.SUPER_ADMIN) && (openDeficiencies === 0)
  };

  return res.json({
    decision,
    prerequisites
  });
});

/**
 * POST /api/decisions/execute
 * Execute formal statutory decision by Competent Authority
 */
router.post('/execute', authenticateToken, (req, res) => {
  const { applicationId, decision, remarks, conditions, reason } = req.body;

  if (!applicationId || !decision) {
    return res.status(400).json({ error: 'applicationId and decision are required.' });
  }

  // Statutory Authority Check
  if (req.user.role !== ROLES.COMPETENT_AUTHORITY && req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({
      error: 'Statutory Privilege Violation',
      message: 'Decision approval / rejection is strictly reserved for the Competent Authority. Administrative roles and AI assistance cannot bypass this requirement.'
    });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Validate no unresolved critical deficiencies
  const openDef = db.prepare(`
    SELECT count(*) as count FROM deficiencies 
    WHERE application_id = ? AND status = 'OPEN' AND severity = 'CRITICAL'
  `).get(applicationId);

  if (openDef && openDef.count > 0) {
    return res.status(400).json({
      error: 'Unresolved Deficiencies Exist',
      message: `Cannot issue statutory decision while ${openDef.count} critical deficiencies remain open.`
    });
  }

  const decisionId = 'dec_' + uuidv4().slice(0, 10);
  const orderNumber = `AICTE/ORDER/${new Date().getFullYear()}/${Math.floor(100000 + Math.random() * 900000)}`;

  db.prepare(`
    INSERT INTO authority_decisions (
      id, application_id, decision_maker_id, decision_maker_name, decision,
      order_number, remarks, conditions, previous_status, new_status, prerequisites_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    decisionId,
    applicationId,
    req.user.id,
    req.user.full_name,
    decision,
    orderNumber,
    remarks || '',
    conditions || '',
    app.status,
    decision
  );

  // Update application status and approval_date
  db.prepare(`
    UPDATE applications SET
      status = ?,
      current_stage = ?,
      approval_date = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(decision, decision, applicationId);

  // Record workflow history
  const historyId = 'wfh_' + uuidv4().slice(0, 10);
  db.prepare(`
    INSERT INTO application_workflow_history (
      id, application_id, from_stage, to_stage, transitioned_by, transitioned_by_role, remarks, prerequisites_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    historyId,
    applicationId,
    app.status,
    decision,
    req.user.id,
    req.user.role,
    `Formal statutory order ${orderNumber} issued by Competent Authority: ${decision}.`
  );

  // Notify Institution
  createNotification({
    institutionId: app.institution_id,
    title: `Statutory Decision Released: ${decision}`,
    message: `Competent Authority has formally issued order ${orderNumber}: ${decision}. Remarks: ${remarks || 'None'}`,
    type: decision === 'APPROVED' ? 'SUCCESS' : 'WARNING',
    link: '/applications'
  });

  return res.json({
    success: true,
    message: `Statutory decision [${decision}] formally executed and registered in government docket.`,
    orderNumber,
    decisionId
  });
});

module.exports = router;
