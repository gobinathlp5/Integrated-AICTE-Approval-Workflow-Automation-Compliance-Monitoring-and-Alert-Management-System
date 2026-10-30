const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');
const { recordDocumentAudit } = require('../audit');

/**
 * GET /api/workflows/templates
 * List all active workflow templates
 */
router.get('/templates', authenticateToken, (req, res) => {
  const templates = db.prepare('SELECT * FROM workflow_templates WHERE is_active = 1').all();
  return res.json({
    templates: templates.map(t => ({
      ...t,
      stages: JSON.parse(t.stages_json)
    }))
  });
});

/**
 * GET /api/workflows/templates/:id
 * Get single workflow template details
 */
router.get('/templates/:id', authenticateToken, (req, res) => {
  const tpl = db.prepare('SELECT * FROM workflow_templates WHERE id = ?').get(req.params.id);
  if (!tpl) {
    return res.status(404).json({ error: 'Workflow template not found' });
  }
  return res.json({
    template: {
      ...tpl,
      stages: JSON.parse(tpl.stages_json)
    }
  });
});

/**
 * POST /api/workflows/transition
 * Executes a stage transition on an application after verifying prerequisites and role authorization
 */
router.post('/transition', authenticateToken, (req, res) => {
  const { applicationId, toStage, remarks } = req.body;

  if (!applicationId || !toStage) {
    return res.status(400).json({ error: 'applicationId and toStage are required.' });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (app.is_on_hold) {
    return res.status(400).json({
      error: 'Application On Hold',
      message: `Application is currently placed on statutory hold (${app.hold_reason}). Resume processing first.`
    });
  }

  const fromStage = app.current_stage || app.status;

  // Prerequisite validation
  if (toStage === 'APPROVED' || toStage === 'REJECTED') {
    // Only Competent Authority or Super Admin can make final decisions
    if (req.user.role !== ROLES.COMPETENT_AUTHORITY && req.user.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        error: 'Statutory Authority Violation',
        message: 'Final approval or rejection can only be executed by the authorized Competent Authority.'
      });
    }

    // Check unresolved deficiencies
    const openDef = db.prepare(`
      SELECT count(*) as count FROM deficiencies 
      WHERE application_id = ? AND status = 'OPEN' AND severity = 'CRITICAL'
    `).get(applicationId);

    if (openDef && openDef.count > 0) {
      return res.status(400).json({
        error: 'Unresolved Critical Deficiencies',
        message: `Cannot finalize decision. Application has ${openDef.count} unresolved critical deficiencies.`
      });
    }
  }

  // Update application current_stage and status
  db.prepare(`
    UPDATE applications SET
      current_stage = ?,
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(toStage, toStage, applicationId);

  // Record workflow history
  const historyId = 'wfh_' + uuidv4().slice(0, 10);
  db.prepare(`
    INSERT INTO application_workflow_history (
      id, application_id, from_stage, to_stage, transitioned_by, transitioned_by_role, remarks, prerequisites_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(historyId, applicationId, fromStage, toStage, req.user.id, req.user.role, remarks || `Transitioned to ${toStage}`);

  // Notify Institution & Officers
  createNotification({
    institutionId: app.institution_id,
    title: `Application Advanced: ${toStage.replace(/_/g, ' ')}`,
    message: `Application ${app.application_number} has transitioned to stage ${toStage}. Remarks: ${remarks || 'None'}`,
    type: toStage === 'SCRUTINY_DEFICIENT' ? 'DEFICIENCY' : toStage === 'APPROVED' ? 'SUCCESS' : 'INFO',
    link: '/applications'
  });

  return res.json({
    success: true,
    message: `Application transitioned from [${fromStage}] to [${toStage}].`,
    currentStage: toStage
  });
});

/**
 * POST /api/workflows/hold
 * Place application on statutory hold
 */
router.post('/hold', authenticateToken, (req, res) => {
  const { applicationId, reason } = req.body;

  if (!applicationId || !reason) {
    return res.status(400).json({ error: 'applicationId and reason are required.' });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Only authorized officers can place on hold
  const canHold = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.COMPETENT_AUTHORITY].includes(req.user.role);
  if (!canHold) {
    return res.status(403).json({ error: 'Permission Denied', message: 'User not authorized to place applications on hold.' });
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
    title: 'Application Placed On Hold',
    message: `Application ${app.application_number} is placed on hold: ${reason}`,
    type: 'WARNING',
    link: '/applications'
  });

  return res.json({ success: true, message: 'Application placed on statutory hold.' });
});

/**
 * POST /api/workflows/resume
 * Resume application from hold
 */
router.post('/resume', authenticateToken, (req, res) => {
  const { applicationId, remarks } = req.body;
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const canResume = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.COMPETENT_AUTHORITY].includes(req.user.role);
  if (!canResume) {
    return res.status(403).json({ error: 'Permission Denied' });
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
    message: `Application ${app.application_number} processing has resumed at stage: ${resumeStage}.`,
    type: 'INFO',
    link: '/applications'
  });

  return res.json({ success: true, message: `Application resumed at stage [${resumeStage}].` });
});

/**
 * GET /api/workflows/history/:applicationId
 * Get full workflow stage timeline
 */
router.get('/history/:applicationId', authenticateToken, (req, res) => {
  const history = db.prepare(`
    SELECT * FROM application_workflow_history 
    WHERE application_id = ? 
    ORDER BY created_at ASC
  `).all(req.params.applicationId);

  return res.json({ history });
});

module.exports = router;
